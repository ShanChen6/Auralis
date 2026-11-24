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


@lru_cache
def get_settings() -> Settings:
    return Settings()
