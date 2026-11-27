import asyncio
import io
import logging
from collections.abc import Mapping
from dataclasses import dataclass

from pydub import AudioSegment
from pydub.silence import detect_leading_silence

from app.tts.engines.base import AudioClip, EngineUnavailableError, TTSEngine, TTSEngineError
from app.tts.text import Paragraph, plan_script
from app.tts.voices import VoicePreset, resolve_voice

logger = logging.getLogger(__name__)

FRAME_RATE = 24_000
SILENCE_THRESHOLD_DBFS = -50.0
EDGE_PADDING_MS = 40


@dataclass(frozen=True)
class ParagraphTiming:
    index: int
    text: str
    start_ms: int
    end_ms: int


@dataclass
class SynthesisResult:
    """Giọng đọc thô (chưa trộn nhạc) + mốc thời gian từng đoạn văn."""

    audio: AudioSegment
    paragraphs: list[ParagraphTiming]
    engine: str
    voice: str
    requested_engine: str
    fallback_reason: str | None = None

    @property
    def duration_ms(self) -> int:
        return len(self.audio)


@dataclass(frozen=True)
class PauseConfig:
    split_commas: bool = True
    comma_ms: int = 250
    sentence_ms: int = 600
    paragraph_ms: int = 1000


class VoiceSynthesizer:
    """Context của Strategy Pattern: chọn engine theo tên, tự fallback khi engine sập."""

    def __init__(
        self,
        engines: Mapping[str, TTSEngine],
        *,
        fallback_engine: str = "edge",
        pauses: PauseConfig | None = None,
        concurrency: int = 4,
    ) -> None:
        if fallback_engine not in engines:
            raise ValueError(f"Engine dự phòng '{fallback_engine}' chưa được đăng ký")
        self._engines = dict(engines)
        self._fallback = fallback_engine
        self._pauses = pauses or PauseConfig()
        self._concurrency = concurrency

    @property
    def engine_names(self) -> list[str]:
        return list(self._engines)

    async def synthesize(
        self,
        script: str,
        *,
        engine: str = "edge",
        voice: str | None = None,
        rate: str = "-5%",
    ) -> SynthesisResult:
        if engine not in self._engines:
            raise ValueError(f"Engine không hỗ trợ: {engine}. Có: {', '.join(self._engines)}")
        paragraphs = plan_script(
            script,
            split_commas=self._pauses.split_commas,
            comma_pause_ms=self._pauses.comma_ms,
            sentence_pause_ms=self._pauses.sentence_ms,
            paragraph_pause_ms=self._pauses.paragraph_ms,
        )
        if not paragraphs:
            raise ValueError("Kịch bản trống")
        preset = resolve_voice(voice)

        try:
            audio, timings = await self._render(self._engines[engine], paragraphs, preset, rate)
            return SynthesisResult(audio, timings, engine, preset.id, engine)
        except EngineUnavailableError as error:
            if engine == self._fallback:
                raise
            logger.warning(
                "Engine %s không khả dụng, chuyển sang %s: %s", engine, self._fallback, error
            )
            # Đọc lại toàn bộ bằng engine dự phòng để giọng nhất quán trong cả số Radio
            fallback = self._engines[self._fallback]
            audio, timings = await self._render(fallback, paragraphs, preset, rate)
            return SynthesisResult(audio, timings, self._fallback, preset.id, engine, str(error))

    async def _render(
        self,
        engine: TTSEngine,
        paragraphs: list[Paragraph],
        voice: VoicePreset,
        rate: str,
    ) -> tuple[AudioSegment, list[ParagraphTiming]]:
        segments = [seg for p in paragraphs for seg in p.segments]
        semaphore = asyncio.Semaphore(self._concurrency)

        async def render_one(text: str) -> AudioSegment:
            async with semaphore:
                clip = await engine.synthesize(text, voice, rate)
            return _trim(_decode(clip))

        tasks = [asyncio.create_task(render_one(seg.text)) for seg in segments]
        try:
            clips = await asyncio.gather(*tasks)
        except BaseException:
            for task in tasks:
                task.cancel()
            raise

        output = AudioSegment.empty().set_frame_rate(FRAME_RATE).set_channels(1)
        timings: list[ParagraphTiming] = []
        clip_iter = iter(clips)
        for index, paragraph in enumerate(paragraphs):
            start = len(output)
            for seg_index, segment in enumerate(paragraph.segments):
                output += next(clip_iter)
                is_last = index == len(paragraphs) - 1 and seg_index == len(paragraph.segments) - 1
                if seg_index == len(paragraph.segments) - 1:
                    end = len(output)
                if not is_last:
                    output += AudioSegment.silent(segment.pause_after_ms, frame_rate=FRAME_RATE)
            timings.append(ParagraphTiming(paragraph.index, paragraph.text, start, end))
        return output, timings


def _decode(clip: AudioClip) -> AudioSegment:
    try:
        audio = AudioSegment.from_file(io.BytesIO(clip.data), format=clip.format)
    except Exception as error:
        raise TTSEngineError(f"Không giải mã được audio ({clip.format}): {error}") from error
    return audio.set_frame_rate(FRAME_RATE).set_channels(1)


def _trim(audio: AudioSegment) -> AudioSegment:
    """Cắt khoảng lặng đầu/cuối mỗi cụm để khoảng nghỉ do ta kiểm soát chính xác."""
    start = detect_leading_silence(audio, SILENCE_THRESHOLD_DBFS)
    end = detect_leading_silence(audio.reverse(), SILENCE_THRESHOLD_DBFS)
    if start + end >= len(audio):
        return audio
    start = max(0, start - EDGE_PADDING_MS)
    end = max(0, end - EDGE_PADDING_MS)
    return audio[start : len(audio) - end]


def build_default_synthesizer() -> VoiceSynthesizer:
    from app.config import get_settings
    from app.tts.engines.edge import EdgeTTSEngine
    from app.tts.engines.voicestudio import VoiceStudioEngine

    settings = get_settings()
    return VoiceSynthesizer(
        {
            "edge": EdgeTTSEngine(proxy=settings.edge_tts_proxy, retries=settings.edge_tts_retries),
            "voicestudio": VoiceStudioEngine(
                base_url=settings.voicestudio_url,
                tts_path=settings.voicestudio_tts_path,
                timeout_s=settings.voicestudio_timeout_s,
            ),
        },
        fallback_engine="edge",
        pauses=PauseConfig(
            split_commas=settings.tts_split_commas,
            comma_ms=settings.tts_comma_pause_ms,
            sentence_ms=settings.tts_sentence_pause_ms,
            paragraph_ms=settings.tts_paragraph_pause_ms,
        ),
        concurrency=settings.tts_concurrency,
    )
