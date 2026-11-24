import asyncio
import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.api.deps import get_producer, get_radio_semaphore, get_storage, require_api_key
from app.config import Settings, get_settings
from app.radio.producer import RadioProducer
from app.storage.base import AudioStorage, StorageError
from app.tts.engines.base import EngineUnavailableError, TTSEngineError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["radio"], dependencies=[Depends(require_api_key)])

MusicId = Literal["piano_rain", "lofi_warm", "acoustic_night"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class GenerateRadioRequest(CamelModel):
    script: str = Field(
        min_length=1, description="Kịch bản; các đoạn văn cách nhau bằng dòng trống"
    )
    engine: Literal["edge", "voicestudio"] = "edge"
    voice: str = Field(default="female_warm", max_length=100)
    rate: str = Field(default="-5%", pattern=r"^[+-]\d{1,2}%$")
    music: MusicId | None = Field(default="piano_rain", description="null = không nhạc nền")
    post_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9-]{1,64}$")


class TimestampOut(CamelModel):
    index: int
    start: float
    end: float


class GenerateRadioResponse(CamelModel):
    audio_url: str
    key: str
    duration: float
    timestamps: list[TimestampOut]
    engine: str
    requested_engine: str
    fallback_reason: str | None
    voice: str
    music: str | None


def build_key(post_id: str | None, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    suffix = uuid.uuid4().hex[:12]
    name = f"{post_id}-{suffix}" if post_id else suffix
    return f"audio/radio/{now:%Y}/{now:%m}/{name}.mp3"


@router.post(
    "/generate-radio",
    response_model=GenerateRadioResponse,
    response_model_by_alias=True,
    summary="Tạo số Radio: TTS → hậu kỳ nhạc nền → upload R2",
)
async def generate_radio(
    body: GenerateRadioRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    producer: Annotated[RadioProducer, Depends(get_producer)],
    storage: Annotated[AudioStorage, Depends(get_storage)],
    semaphore: Annotated[asyncio.Semaphore, Depends(get_radio_semaphore)],
) -> GenerateRadioResponse:
    words = len(body.script.split())
    if words > settings.radio_max_words:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Kịch bản dài {words} từ, tối đa {settings.radio_max_words} từ",
        )

    async with semaphore:  # giới hạn số Radio sản xuất đồng thời (tốn CPU)
        try:
            episode = await producer.produce(
                body.script,
                engine=body.engine,
                voice=body.voice,
                rate=body.rate,
                music_id=body.music,
            )
        except EngineUnavailableError as error:
            logger.error("TTS không khả dụng: %s", error)
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(error)) from error
        except TTSEngineError as error:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(error)) from error
        except ValueError as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error

        mp3 = await asyncio.to_thread(episode.mix.to_mp3_bytes, settings.radio_mp3_bitrate)

    key = build_key(body.post_id)
    try:
        audio_url = await storage.upload(mp3, key, "audio/mpeg")
    except StorageError as error:
        logger.error("Upload thất bại: %s", error)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(error)) from error

    return GenerateRadioResponse(
        audio_url=audio_url,
        key=key,
        duration=episode.mix.duration,
        timestamps=[TimestampOut(**t.to_dict()) for t in episode.mix.timestamps],
        engine=episode.engine,
        requested_engine=episode.requested_engine,
        fallback_reason=episode.fallback_reason,
        voice=episode.voice,
        music=episode.mix.music_id,
    )
