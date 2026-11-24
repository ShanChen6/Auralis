from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "auralis-audio-ai"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:4000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
