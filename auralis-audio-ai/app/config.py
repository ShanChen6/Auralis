import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "auralis-audio-ai"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:4000"]

    # --- TTS chung ---
    tts_default_rate: str = "-5%"
    tts_concurrency: int = 4
    tts_split_commas: bool = True
    tts_comma_pause_ms: int = 250
    tts_sentence_pause_ms: int = 600
    tts_paragraph_pause_ms: int = 1000

    # --- edge-tts ---
    # aiohttp của edge-tts không tự đọc biến proxy, nên truyền tường minh.
    edge_tts_proxy: str | None = Field(
        default_factory=lambda: os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    )
    edge_tts_retries: int = 2

    # --- VoiceStudio (Local API, có thể qua Cloudflare Tunnel) ---
    voicestudio_url: str = "http://localhost:3900"
    voicestudio_tts_path: str = "/api/tts"
    voicestudio_timeout_s: float = 120.0

    # --- API generate-radio ---
    #: Nếu đặt, mọi request tới /api/v1/generate-radio phải có header X-API-Key khớp
    audio_ai_api_key: str | None = None
    radio_max_words: int = 3000
    radio_max_concurrent: int = 2
    radio_mp3_bitrate: str = "128k"

    # --- Lưu trữ: Cloudflare R2 (thiếu biến R2_* thì lưu local trong media/) ---
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket: str | None = None
    r2_public_url: str | None = None
    r2_endpoint: str | None = None
    local_media_dir: str = "media"
    public_base_url: str = "http://localhost:8000"

    @property
    def r2_configured(self) -> bool:
        return all(
            [
                self.r2_account_id,
                self.r2_access_key_id,
                self.r2_secret_access_key,
                self.r2_bucket,
                self.r2_public_url,
            ]
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
