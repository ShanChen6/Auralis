from dataclasses import dataclass

from app.radio.mixer import RadioMix, RadioMixer
from app.radio.music import MusicLibrary
from app.tts.synthesizer import VoiceSynthesizer


@dataclass
class RadioEpisode:
    mix: RadioMix
    engine: str
    requested_engine: str
    voice: str
    fallback_reason: str | None


class RadioProducer:
    """Kịch bản → giọng đọc (TTS) → hậu kỳ (nhạc nền + ducking) → số Radio hoàn chỉnh."""

    def __init__(
        self,
        synthesizer: VoiceSynthesizer,
        mixer: RadioMixer | None = None,
        music: MusicLibrary | None = None,
    ) -> None:
        self._synthesizer = synthesizer
        self._mixer = mixer or RadioMixer()
        self._music = music or MusicLibrary()

    async def produce(
        self,
        script: str,
        *,
        engine: str = "edge",
        voice: str | None = None,
        rate: str = "-5%",
        music_id: str | None = "piano_rain",
    ) -> RadioEpisode:
        # Nạp nhạc trước để báo lỗi sớm, không tốn công gọi TTS
        music = self._music.load(music_id) if music_id else None
        speech = await self._synthesizer.synthesize(script, engine=engine, voice=voice, rate=rate)
        mix = self._mixer.mix(speech.audio, speech.paragraphs, music, music_id=music_id)
        return RadioEpisode(
            mix=mix,
            engine=speech.engine,
            requested_engine=speech.requested_engine,
            voice=speech.voice,
            fallback_reason=speech.fallback_reason,
        )
