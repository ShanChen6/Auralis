import asyncio
import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status

from app.config import Settings, get_settings
from app.radio.producer import RadioProducer
from app.storage.base import AudioStorage


def get_producer(request: Request) -> RadioProducer:
    return request.app.state.producer


def get_storage(request: Request) -> AudioStorage:
    return request.app.state.storage


def get_radio_semaphore(request: Request) -> asyncio.Semaphore:
    return request.app.state.radio_semaphore


def require_api_key(
    settings: Annotated[Settings, Depends(get_settings)],
    x_api_key: Annotated[str | None, Header()] = None,
) -> None:
    """Bảo vệ dịch vụ nội bộ: chỉ NestJS (có API key) được gọi tạo Radio."""
    expected = settings.audio_ai_api_key
    if expected and not (x_api_key and secrets.compare_digest(x_api_key, expected)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Thiếu hoặc sai X-API-Key")
