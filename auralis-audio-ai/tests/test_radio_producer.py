import asyncio
from pathlib import Path

import pytest
from pydub import AudioSegment
from pydub.generators import Sine

from app.radio.music import MUSIC_TRACKS, MusicLibrary
from app.radio.producer import RadioProducer
from app.tts.synthesizer import ParagraphTiming, SynthesisResult


class FakeSynthesizer:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def synthesize(self, script: str, **kwargs) -> SynthesisResult:
        self.calls.append({"script": script, **kwargs})
        audio = Sine(220).to_audio_segment(duration=2000).set_channels(1)
        return SynthesisResult(
            audio,
            [ParagraphTiming(0, script, 0, 2000)],
            "edge",
            "female_warm",
            "voicestudio",
            "off",
        )


def test_bundled_placeholder_tracks_exist_and_load() -> None:
    library = MusicLibrary()
    for music_id in MUSIC_TRACKS:
        assert len(library.load(music_id)) > 30_000


def test_music_library_errors(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="không tồn tại"):
        MusicLibrary().load("jazz")
    with pytest.raises(FileNotFoundError):
        MusicLibrary(tmp_path).load("piano_rain")


def test_producer_runs_tts_then_mix() -> None:
    synth = FakeSynthesizer()
    episode = asyncio.run(
        RadioProducer(synth).produce(
            "Xin chào.", engine="voicestudio", voice="male_deep", music_id="lofi_warm"
        )
    )
    assert synth.calls == [
        {"script": "Xin chào.", "engine": "voicestudio", "voice": "male_deep", "rate": "-5%"}
    ]
    assert episode.mix.duration == pytest.approx(9.0, abs=0.01)  # 3s + 2s + 4s
    assert episode.mix.timestamps[0].start == 3.0
    assert (episode.engine, episode.requested_engine, episode.fallback_reason) == (
        "edge",
        "voicestudio",
        "off",
    )


def test_producer_fails_fast_on_unknown_music() -> None:
    synth = FakeSynthesizer()
    with pytest.raises(ValueError):
        asyncio.run(RadioProducer(synth).produce("Xin chào.", music_id="jazz"))
    assert synth.calls == []


def test_producer_without_music() -> None:
    episode = asyncio.run(RadioProducer(FakeSynthesizer()).produce("Xin chào.", music_id=None))
    assert isinstance(episode.mix.audio, AudioSegment)
    assert episode.mix.duration == pytest.approx(2.0, abs=0.01)
