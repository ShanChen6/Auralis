import httpx

from app.tts.engines.base import AudioClip, EngineUnavailableError, TTSEngine, TTSEngineError
from app.tts.voices import VoicePreset

_CONTENT_TYPE_FORMATS = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
}


def rate_to_speed(rate: str) -> float:
    """Đổi rate kiểu edge ("-5%") sang hệ số tốc độ (0.95)."""
    value = rate.strip().rstrip("%")
    return round(1 + float(value) / 100, 3) if value else 1.0


class VoiceStudioEngine(TTSEngine):
    """Chế độ Studio: gọi Local API của VoiceStudio (giọng nhân bản cảm xúc cao).

    Request: POST {base_url}{tts_path} JSON {"text", "voice", "speed"}
    Response: file audio (Content-Type audio/wav | audio/mpeg ...).
    """

    name = "voicestudio"

    def __init__(
        self,
        *,
        base_url: str,
        tts_path: str = "/api/tts",
        timeout_s: float = 120.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url, timeout=timeout_s, transport=transport, trust_env=False
        )
        self._tts_path = tts_path

    async def synthesize(self, text: str, voice: VoicePreset, rate: str) -> AudioClip:
        payload = {
            "text": text,
            "voice": voice.voicestudio_voice or voice.id,
            "speed": rate_to_speed(rate),
        }
        try:
            response = await self._client.post(self._tts_path, json=payload)
        except httpx.TransportError as error:
            raise EngineUnavailableError(f"Không kết nối được VoiceStudio: {error!r}") from error

        if response.status_code >= 500:
            raise EngineUnavailableError(f"VoiceStudio lỗi {response.status_code}")
        if response.status_code >= 400:
            raise TTSEngineError(f"VoiceStudio từ chối ({response.status_code}): {response.text}")

        content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
        audio_format = _CONTENT_TYPE_FORMATS.get(content_type)
        if audio_format is None or not response.content:
            raise TTSEngineError(f"VoiceStudio trả về dữ liệu không phải audio ({content_type})")
        return AudioClip(response.content, audio_format)

    async def aclose(self) -> None:
        await self._client.aclose()
