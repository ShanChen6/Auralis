import asyncio
from pathlib import Path

from app.storage.base import StorageError, public_url


class LocalStorage:
    """Lưu file vào thư mục local (dùng khi chưa cấu hình R2) và phục vụ qua /media."""

    def __init__(self, directory: Path, *, public_base_url: str) -> None:
        self._directory = directory.resolve()
        self._public_base_url = public_base_url

    @property
    def directory(self) -> Path:
        return self._directory

    async def upload(self, data: bytes, key: str, content_type: str) -> str:
        path = (self._directory / key).resolve()
        if not path.is_relative_to(self._directory):
            raise StorageError(f"Key không hợp lệ: {key}")
        try:
            await asyncio.to_thread(self._write, path, data)
        except OSError as error:
            raise StorageError(f"Không ghi được file: {error}") from error
        return public_url(self._public_base_url, key)

    @staticmethod
    def _write(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
