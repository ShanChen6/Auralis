from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.tts.voices import VoicePreset


class TTSEngineError(Exception):
    """Lỗi tạo giọng không thể tự khắc phục (VD: request sai)."""


class EngineUnavailableError(TTSEngineError):
    """Engine không kết nối được / quá tải – nên chuyển sang engine dự phòng."""


@dataclass(frozen=True)
class AudioClip:
    data: bytes
    format: str  # "mp3", "wav", ... (định dạng để pydub giải mã)


class TTSEngine(ABC):
    """Strategy: mỗi engine biến một cụm văn bản thành audio."""

    name: str

    @abstractmethod
    async def synthesize(self, text: str, voice: VoicePreset, rate: str) -> AudioClip: ...
