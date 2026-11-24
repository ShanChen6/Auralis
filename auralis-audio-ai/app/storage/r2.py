import asyncio
from typing import TYPE_CHECKING

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.storage.base import StorageError, public_url

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


def create_r2_client(
    *, account_id: str, access_key_id: str, secret_access_key: str, endpoint: str | None = None
) -> "S3Client":
    return boto3.client(
        "s3",
        endpoint_url=endpoint or f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name="auto",
        config=Config(
            retries={"max_attempts": 3, "mode": "standard"},
            s3={"addressing_style": "path" if endpoint else "virtual"},
        ),
    )


class R2Storage:
    """Upload lên Cloudflare R2 (tương thích S3) qua boto3."""

    def __init__(self, client: "S3Client", *, bucket: str, public_base_url: str) -> None:
        self._client = client
        self._bucket = bucket
        self._public_base_url = public_base_url

    async def upload(self, data: bytes, key: str, content_type: str) -> str:
        try:
            # boto3 là thư viện đồng bộ: chạy ở thread riêng
            await asyncio.to_thread(
                self._client.put_object,
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                ContentLength=len(data),
                CacheControl="public, max-age=31536000, immutable",
            )
        except (BotoCoreError, ClientError) as error:
            raise StorageError(f"Upload R2 thất bại: {error}") from error
        return public_url(self._public_base_url, key)
