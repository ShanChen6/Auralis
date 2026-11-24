import asyncio
import re

import pytest
from fastapi.testclient import TestClient
from pydub.generators import Sine

from app.api.deps import get_producer, get_radio_semaphore, get_storage
from app.api.radio import build_key
from app.config import Settings, get_settings
from app.main import app
from app.radio.mixer import RadioMixer
from app.radio.producer import RadioEpisode
from app.storage.base import StorageError
from app.tts.engines.base import EngineUnavailableError, TTSEngineError
from app.tts.synthesizer import ParagraphTiming

URL = "/api/v1/generate-radio"


class FakeProducer:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.calls: list[dict] = []

    async def produce(self, script: str, **kwargs) -> RadioEpisode:
        self.calls.append({"script": script, **kwargs})
        if self.error:
            raise self.error
        voice = Sine(220).to_audio_segment(duration=1000).set_channels(1)
        mix = RadioMixer().mix(voice, [ParagraphTiming(0, script, 0, 1000)], None, music_id=None)
        return RadioEpisode(mix, "edge", kwargs["engine"], kwargs["voice"], None)


class FakeStorage:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.uploads: list[tuple[bytes, str, str]] = []

    async def upload(self, data: bytes, key: str, content_type: str) -> str:
        if self.error:
            raise self.error
        self.uploads.append((data, key, content_type))
        return f"https://cdn.auralis.test/{key}"


@pytest.fixture
def setup():
    producer, storage = FakeProducer(), FakeStorage()
    settings = Settings(audio_ai_api_key=None, radio_max_words=50)
    app.dependency_overrides.update(
        {
            get_producer: lambda: producer,
            get_storage: lambda: storage,
            get_radio_semaphore: lambda: asyncio.Semaphore(1),
            get_settings: lambda: settings,
        }
    )
    yield TestClient(app), producer, storage, settings
    app.dependency_overrides.clear()


def test_generate_radio_success(setup) -> None:
    client, producer, storage, _ = setup
    res = client.post(
        URL,
        json={
            "script": "Đêm nay trời mưa.",
            "engine": "voicestudio",
            "voice": "male_deep",
            "rate": "-10%",
            "music": "lofi_warm",
            "postId": "0193f2a1-abcd",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()

    assert producer.calls == [
        {
            "script": "Đêm nay trời mưa.",
            "engine": "voicestudio",
            "voice": "male_deep",
            "rate": "-10%",
            "music_id": "lofi_warm",
        }
    ]
    data, key, content_type = storage.uploads[0]
    assert content_type == "audio/mpeg"
    assert data[:3] == b"ID3" or data[0] == 0xFF  # MP3 thật
    assert re.fullmatch(r"audio/radio/\d{4}/\d{2}/0193f2a1-abcd-[0-9a-f]{12}\.mp3", key)

    assert body == {
        "audioUrl": f"https://cdn.auralis.test/{key}",
        "key": key,
        "duration": 1.0,
        "timestamps": [{"index": 0, "start": 0.0, "end": 1.0}],
        "engine": "edge",
        "requestedEngine": "voicestudio",
        "fallbackReason": None,
        "voice": "male_deep",
        "music": None,
    }


def test_defaults(setup) -> None:
    client, producer, _, _ = setup
    assert client.post(URL, json={"script": "Xin chào."}).status_code == 200
    assert producer.calls[0] == {
        "script": "Xin chào.",
        "engine": "edge",
        "voice": "female_warm",
        "rate": "-5%",
        "music_id": "piano_rain",
    }


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"script": ""},
        {"script": "a", "engine": "openai"},
        {"script": "a", "music": "jazz"},
        {"script": "a", "rate": "slow"},
        {"script": "a", "postId": "../../etc"},
    ],
)
def test_validation_errors(setup, payload) -> None:
    client, producer, _, _ = setup
    assert client.post(URL, json=payload).status_code == 422
    assert producer.calls == []


def test_word_limit(setup) -> None:
    client, producer, _, settings = setup
    res = client.post(URL, json={"script": "chữ " * (settings.radio_max_words + 1)})
    assert res.status_code == 422
    assert "tối đa 50 từ" in res.json()["detail"]
    assert producer.calls == []


@pytest.mark.parametrize(
    ("error", "status"),
    [
        (EngineUnavailableError("edge down"), 503),
        (TTSEngineError("bad voice"), 502),
        (ValueError("Kịch bản trống"), 422),
    ],
)
def test_producer_errors(setup, error, status) -> None:
    client, producer, storage, _ = setup
    producer.error = error
    res = client.post(URL, json={"script": "Xin chào."})
    assert res.status_code == status
    assert res.json()["detail"] == str(error)
    assert storage.uploads == []


def test_storage_error(setup) -> None:
    client, _, storage, _ = setup
    storage.error = StorageError("R2 down")
    res = client.post(URL, json={"script": "Xin chào."})
    assert res.status_code == 502


def test_api_key_required_when_configured(setup) -> None:
    client, _, _, settings = setup
    settings.audio_ai_api_key = "secret-key"
    assert client.post(URL, json={"script": "a"}).status_code == 401
    assert client.post(URL, json={"script": "a"}, headers={"X-API-Key": "wrong"}).status_code == 401
    ok = client.post(URL, json={"script": "Xin chào."}, headers={"X-API-Key": "secret-key"})
    assert ok.status_code == 200


def test_build_key_without_post_id() -> None:
    assert re.fullmatch(r"audio/radio/\d{4}/\d{2}/[0-9a-f]{12}\.mp3", build_key(None))
