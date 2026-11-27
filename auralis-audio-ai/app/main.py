import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.radio import router as radio_router
from app.config import Settings, get_settings
from app.radio.producer import RadioProducer
from app.storage.base import AudioStorage
from app.storage.local import LocalStorage
from app.storage.r2 import R2Storage, create_r2_client
from app.tts.synthesizer import build_default_synthesizer

logger = logging.getLogger(__name__)
settings = get_settings()


def build_storage(settings: Settings) -> AudioStorage:
    if settings.r2_configured:
        client = create_r2_client(
            account_id=settings.r2_account_id or "",
            access_key_id=settings.r2_access_key_id or "",
            secret_access_key=settings.r2_secret_access_key or "",
            endpoint=settings.r2_endpoint,
        )
        return R2Storage(
            client, bucket=settings.r2_bucket or "", public_base_url=settings.r2_public_url or ""
        )
    logger.warning(
        "Chưa cấu hình R2_*: file Radio được lưu local trong %s/", settings.local_media_dir
    )
    return LocalStorage(
        Path(settings.local_media_dir),
        public_base_url=f"{settings.public_base_url.rstrip('/')}/media",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.producer = RadioProducer(build_default_synthesizer())
    app.state.storage = build_storage(settings)
    app.state.radio_semaphore = asyncio.Semaphore(settings.radio_max_concurrent)
    yield


app = FastAPI(title="Auralis Audio AI", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(radio_router)

if not settings.r2_configured:
    media_dir = Path(settings.local_media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=media_dir), name="media")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "status": "ok",
        "storage": "r2" if settings.r2_configured else "local",
        "timestamp": datetime.now(UTC).isoformat(),
    }
