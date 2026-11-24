from typing import Protocol
from urllib.parse import quote


class StorageError(Exception):
    """Không lưu được file lên kho lưu trữ."""


class AudioStorage(Protocol):
    async def upload(self, data: bytes, key: str, content_type: str) -> str:
        """Lưu file và trả về URL công khai."""
        ...


def public_url(base: str, key: str) -> str:
    return f"{base.rstrip('/')}/{quote(key)}"
