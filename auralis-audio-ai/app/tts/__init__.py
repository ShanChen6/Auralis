"""Lõi tạo giọng đọc đa chế độ (Strategy Pattern): edge-tts và VoiceStudio."""

from app.tts.engines.base import EngineUnavailableError, TTSEngine, TTSEngineError
from app.tts.synthesizer import ParagraphTiming, SynthesisResult, VoiceSynthesizer
from app.tts.voices import VOICE_PRESETS, VoicePreset, resolve_voice

__all__ = [
    "VOICE_PRESETS",
    "EngineUnavailableError",
    "ParagraphTiming",
    "SynthesisResult",
    "TTSEngine",
    "TTSEngineError",
    "VoicePreset",
    "VoiceSynthesizer",
    "resolve_voice",
]
