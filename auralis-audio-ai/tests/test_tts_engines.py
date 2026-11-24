import asyncio
import json
from typing import ClassVar

import httpx
import pytest

from app.tts.engines import edge as edge_module
from app.tts.engines.base import EngineUnavailableError, TTSEngineError
from app.tts.engines.edge import EdgeTTSEngine
from app.tts.engines.voicestudio import VoiceStudioEngine, rate_to_speed
from app.tts.voices import VOICE_PRESETS, resolve_voice


def run(coro):
    return asyncio.run(coro)


# --- voices ------------------------------------------------------------------


def test_resolve_voice() -> None:
    assert resolve_voice(None).edge_voice == "vi-VN-HoaiMyNeural"
    assert resolve_voice("male_deep").edge_voice == "vi-VN-NamMinhNeural"
    assert resolve_voice("vi-VN-NamMinhNeural").id == "male_deep"
    assert resolve_voice("en-US-AriaNeural").edge_voice == "en-US-AriaNeural"
    cloned = resolve_voice("giong-shan-studio")
    assert cloned.voicestudio_voice == "giong-shan-studio"
    assert cloned.edge_voice == "vi-VN-HoaiMyNeural"


# --- VoiceStudio -------------------------------------------------------------


def studio(handler) -> VoiceStudioEngine:
    return VoiceStudioEngine(
        base_url="http://voicestudio.test", transport=httpx.MockTransport(handler)
    )


def test_rate_to_speed() -> None:
    assert rate_to_speed("-5%") == 0.95
    assert rate_to_speed("+10%") == 1.1
    assert rate_to_speed("0%") == 1.0


def test_voicestudio_posts_text_voice_and_speed() -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, content=b"RIFF....", headers={"content-type": "audio/wav"})

    clip = run(studio(handler).synthesize("Xin chào", resolve_voice("giong-studio"), "-5%"))

    assert seen["url"] == "http://voicestudio.test/api/tts"
    assert seen["body"] == {"text": "Xin chào", "voice": "giong-studio", "speed": 0.95}
    assert clip.format == "wav" and clip.data == b"RIFF...."


@pytest.mark.parametrize(
    ("content_type", "fmt"), [("audio/mpeg", "mp3"), ("audio/x-wav; charset=binary", "wav")]
)
def test_voicestudio_maps_content_type(content_type: str, fmt: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"x", headers={"content-type": content_type})

    assert run(studio(handler).synthesize("a", VOICE_PRESETS["female_warm"], "0%")).format == fmt


def test_voicestudio_connection_error_is_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(EngineUnavailableError):
        run(studio(handler).synthesize("a", VOICE_PRESETS["female_warm"], "0%"))


def test_voicestudio_server_error_is_unavailable() -> None:
    with pytest.raises(EngineUnavailableError, match="503"):
        run(
            studio(lambda r: httpx.Response(503)).synthesize(
                "a", VOICE_PRESETS["female_warm"], "0%"
            )
        )


def test_voicestudio_client_error_is_not_retried_elsewhere() -> None:
    with pytest.raises(TTSEngineError, match="400") as info:
        run(
            studio(lambda r: httpx.Response(400, text="unknown voice")).synthesize(
                "a", VOICE_PRESETS["female_warm"], "0%"
            )
        )
    assert not isinstance(info.value, EngineUnavailableError)


def test_voicestudio_rejects_non_audio_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"error": "x"})

    with pytest.raises(TTSEngineError, match="không phải audio"):
        run(studio(handler).synthesize("a", VOICE_PRESETS["female_warm"], "0%"))


# --- edge-tts ----------------------------------------------------------------


class FakeCommunicate:
    instances: ClassVar[list["FakeCommunicate"]] = []
    failures: ClassVar[int] = 0

    def __init__(self, text: str, voice: str, *, rate: str, proxy: str | None) -> None:
        self.args = (text, voice, rate, proxy)
        FakeCommunicate.instances.append(self)

    async def stream(self):
        if FakeCommunicate.failures > 0:
            FakeCommunicate.failures -= 1
            raise ConnectionError("ws closed")
        yield {"type": "WordBoundary", "offset": 0}
        yield {"type": "audio", "data": b"ID3"}
        yield {"type": "audio", "data": b"-mp3"}


@pytest.fixture
def fake_edge(monkeypatch: pytest.MonkeyPatch) -> type[FakeCommunicate]:
    FakeCommunicate.instances = []
    FakeCommunicate.failures = 0
    monkeypatch.setattr(edge_module.edge_tts, "Communicate", FakeCommunicate)
    real_sleep = asyncio.sleep
    monkeypatch.setattr(edge_module.asyncio, "sleep", lambda *_: real_sleep(0))
    return FakeCommunicate


def test_edge_streams_audio_with_voice_rate_and_proxy(fake_edge) -> None:
    engine = EdgeTTSEngine(proxy="http://proxy:3128")
    clip = run(engine.synthesize("Xin chào", VOICE_PRESETS["male_deep"], "-5%"))
    assert clip.data == b"ID3-mp3" and clip.format == "mp3"
    assert fake_edge.instances[0].args == (
        "Xin chào",
        "vi-VN-NamMinhNeural",
        "-5%",
        "http://proxy:3128",
    )


def test_edge_retries_then_succeeds(fake_edge) -> None:
    fake_edge.failures = 2
    clip = run(EdgeTTSEngine(retries=2).synthesize("a", VOICE_PRESETS["female_warm"], "0%"))
    assert clip.data == b"ID3-mp3"
    assert len(fake_edge.instances) == 3


def test_edge_gives_up_after_retries(fake_edge) -> None:
    fake_edge.failures = 5
    with pytest.raises(EngineUnavailableError, match="ws closed"):
        run(EdgeTTSEngine(retries=1).synthesize("a", VOICE_PRESETS["female_warm"], "0%"))
    assert len(fake_edge.instances) == 2


@pytest.mark.network
def test_edge_real_synthesis() -> None:
    """Gọi edge-tts thật: uv run pytest -m network"""
    from app.config import get_settings

    engine = EdgeTTSEngine(proxy=get_settings().edge_tts_proxy)
    clip = run(engine.synthesize("Xin chào Auralis.", VOICE_PRESETS["female_warm"], "-5%"))
    assert len(clip.data) > 1000
