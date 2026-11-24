import asyncio
import logging

import edge_tts

from app.tts.engines.base import AudioClip, EngineUnavailableError, TTSEngine
from app.tts.voices import VoicePreset

logger = logging.getLogger(__name__)


class EdgeTTSEngine(TTSEngine):
    """Chế độ Nhanh: Microsoft Edge TTS (online, miễn phí, chạy 24/7)."""

    name = "edge"

    def __init__(self, *, proxy: str | None = None, retries: int = 2) -> None:
        self._proxy = proxy
        self._retries = retries

    async def synthesize(self, text: str, voice: VoicePreset, rate: str) -> AudioClip:
        last_error: Exception | None = None
        for attempt in range(self._retries + 1):
            try:
                return AudioClip(await self._stream(text, voice.edge_voice, rate), "mp3")
            except Exception as error:  # noqa: BLE001 - edge-tts ném nhiều loại lỗi mạng
                last_error = error
                logger.warning("edge-tts lỗi (lần %d): %s", attempt + 1, error)
                if attempt < self._retries:
                    await asyncio.sleep(0.5 * 2**attempt)
        raise EngineUnavailableError(f"edge-tts không phản hồi: {last_error}") from last_error

    async def _stream(self, text: str, voice: str, rate: str) -> bytes:
        communicate = edge_tts.Communicate(text, voice, rate=rate, proxy=self._proxy)
        chunks = [chunk["data"] async for chunk in communicate.stream() if chunk["type"] == "audio"]
        if not chunks:
            raise RuntimeError("edge-tts không trả về audio")
        return b"".join(chunks)
