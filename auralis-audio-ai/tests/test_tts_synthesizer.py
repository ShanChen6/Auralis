import asyncio
import io

import pytest
from pydub.generators import Sine

from app.tts.engines.base import AudioClip, EngineUnavailableError, TTSEngine, TTSEngineError
from app.tts.synthesizer import PauseConfig, VoiceSynthesizer
from app.tts.voices import VoicePreset

MS_PER_CHAR = 10


def tone(text: str, fmt: str = "wav") -> bytes:
    """Âm thanh giả: độ dài tỉ lệ với số ký tự, để kiểm tra mốc thời gian."""
    buffer = io.BytesIO()
    Sine(440).to_audio_segment(duration=len(text) * MS_PER_CHAR).export(buffer, format=fmt)
    return buffer.getvalue()


class FakeEngine(TTSEngine):
    def __init__(self, name: str, *, fail_with: Exception | None = None, delay: float = 0) -> None:
        self.name = name
        self.calls: list[tuple[str, VoicePreset, str]] = []
        self._fail_with = fail_with
        self._delay = delay

    async def synthesize(self, text: str, voice: VoicePreset, rate: str) -> AudioClip:
        self.calls.append((text, voice, rate))
        if self._delay:
            # Cụm ngắn trả về trước, để kiểm tra thứ tự ghép không bị đảo
            await asyncio.sleep(self._delay * len(text) / 10)
        if self._fail_with:
            raise self._fail_with
        return AudioClip(tone(text), "wav")


PAUSES = PauseConfig(split_commas=True, comma_ms=250, sentence_ms=600, paragraph_ms=1000)
SCRIPT = "Câu thứ nhất của đoạn đầu. Câu hai.\n\nĐoạn thứ hai rất ngắn."


def run(coro):
    return asyncio.run(coro)


def test_timings_follow_clip_lengths_and_pauses() -> None:
    edge = FakeEngine("edge", delay=0.01)
    synth = VoiceSynthesizer({"edge": edge}, pauses=PAUSES)

    result = run(synth.synthesize(SCRIPT, engine="edge", voice="male_deep", rate="-5%"))

    first = len("Câu thứ nhất của đoạn đầu.") * MS_PER_CHAR
    second = len("Câu hai.") * MS_PER_CHAR
    third = len("Đoạn thứ hai rất ngắn.") * MS_PER_CHAR
    p0_end = first + 600 + second
    p1_start = p0_end + 1000

    assert [(p.index, p.start_ms, p.end_ms) for p in result.paragraphs] == [
        (0, 0, pytest.approx(p0_end, abs=2)),
        (1, pytest.approx(p1_start, abs=2), pytest.approx(p1_start + third, abs=3)),
    ]
    # Không thêm khoảng lặng sau cụm cuối cùng
    assert result.duration_ms == pytest.approx(p1_start + third, abs=3)
    assert result.engine == "edge" and result.fallback_reason is None
    assert result.voice == "male_deep"
    assert result.audio.frame_rate == 24_000 and result.audio.channels == 1
    assert {voice.edge_voice for _, voice, _ in edge.calls} == {"vi-VN-NamMinhNeural"}
    assert {rate for *_, rate in edge.calls} == {"-5%"}


def test_falls_back_to_edge_when_primary_is_unavailable() -> None:
    edge = FakeEngine("edge")
    studio = FakeEngine("voicestudio", fail_with=EngineUnavailableError("offline"))
    synth = VoiceSynthesizer({"edge": edge, "voicestudio": studio}, pauses=PAUSES)

    result = run(synth.synthesize(SCRIPT, engine="voicestudio", voice="female_warm"))

    assert result.engine == "edge"
    assert result.requested_engine == "voicestudio"
    assert result.fallback_reason == "offline"
    assert len(edge.calls) == 3  # đọc lại toàn bộ kịch bản bằng edge


def test_does_not_fall_back_on_request_errors() -> None:
    edge = FakeEngine("edge")
    studio = FakeEngine("voicestudio", fail_with=TTSEngineError("bad voice"))
    synth = VoiceSynthesizer({"edge": edge, "voicestudio": studio}, pauses=PAUSES)

    with pytest.raises(TTSEngineError, match="bad voice"):
        run(synth.synthesize(SCRIPT, engine="voicestudio"))
    assert edge.calls == []


def test_raises_when_fallback_engine_itself_fails() -> None:
    edge = FakeEngine("edge", fail_with=EngineUnavailableError("edge down"))
    synth = VoiceSynthesizer({"edge": edge}, pauses=PAUSES)
    with pytest.raises(EngineUnavailableError, match="edge down"):
        run(synth.synthesize(SCRIPT, engine="edge"))


def test_trims_engine_silence_so_pauses_are_exact() -> None:
    class PaddedEngine(FakeEngine):
        async def synthesize(self, text: str, voice: VoicePreset, rate: str) -> AudioClip:
            from pydub import AudioSegment

            padded = (
                AudioSegment.silent(500)
                + Sine(440).to_audio_segment(duration=300)
                + AudioSegment.silent(500)
            )
            buffer = io.BytesIO()
            padded.export(buffer, format="wav")
            return AudioClip(buffer.getvalue(), "wav")

    synth = VoiceSynthesizer({"edge": PaddedEngine("edge")}, pauses=PAUSES)
    result = run(synth.synthesize("Một câu.", engine="edge"))
    # ~300ms tiếng + đệm nhỏ mỗi bên (độ phân giải 10ms), thay vì 1300ms
    assert 300 <= result.duration_ms <= 420


def test_decodes_mp3_clips() -> None:
    class Mp3Engine(FakeEngine):
        async def synthesize(self, text: str, voice: VoicePreset, rate: str) -> AudioClip:
            return AudioClip(tone(text, "mp3"), "mp3")

    synth = VoiceSynthesizer({"edge": Mp3Engine("edge")}, pauses=PAUSES)
    result = run(synth.synthesize("Một câu ngắn.", engine="edge"))
    assert result.duration_ms > 0


def test_rejects_unknown_engine_and_empty_script() -> None:
    synth = VoiceSynthesizer({"edge": FakeEngine("edge")})
    with pytest.raises(ValueError, match="Engine không hỗ trợ"):
        run(synth.synthesize("Xin chào.", engine="openai"))
    with pytest.raises(ValueError, match="trống"):
        run(synth.synthesize("   \n\n", engine="edge"))


def test_respects_concurrency_limit() -> None:
    active = 0
    peak = 0

    class CountingEngine(FakeEngine):
        async def synthesize(self, text: str, voice: VoicePreset, rate: str) -> AudioClip:
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.01)
            active -= 1
            return AudioClip(tone(text), "wav")

    script = " ".join(f"Câu số {i} của kịch bản." for i in range(10))
    synth = VoiceSynthesizer({"edge": CountingEngine("edge")}, pauses=PAUSES, concurrency=3)
    run(synth.synthesize(script, engine="edge"))
    assert peak == 3
