import asyncio
from pathlib import Path

import boto3
import pytest
from botocore.stub import ANY, Stubber

from app.storage.base import StorageError
from app.storage.local import LocalStorage
from app.storage.r2 import R2Storage, create_r2_client


def run(coro):
    return asyncio.run(coro)


def stubbed_client():
    client = boto3.client(
        "s3",
        endpoint_url="https://acc.r2.cloudflarestorage.com",
        aws_access_key_id="k",
        aws_secret_access_key="s",
        region_name="auto",
    )
    return client, Stubber(client)


def test_r2_put_object_and_public_url() -> None:
    client, stub = stubbed_client()
    stub.add_response(
        "put_object",
        {"ETag": '"abc"'},
        {
            "Bucket": "auralis-media",
            "Key": "audio/radio/2026/11/a b.mp3",
            "Body": ANY,
            "ContentType": "audio/mpeg",
            "ContentLength": 3,
            "CacheControl": "public, max-age=31536000, immutable",
        },
    )
    storage = R2Storage(client, bucket="auralis-media", public_base_url="https://cdn.auralis.vn/")
    with stub:
        url = run(storage.upload(b"ID3", "audio/radio/2026/11/a b.mp3", "audio/mpeg"))
    assert url == "https://cdn.auralis.vn/audio/radio/2026/11/a%20b.mp3"
    stub.assert_no_pending_responses()


def test_r2_client_error_becomes_storage_error() -> None:
    client, stub = stubbed_client()
    stub.add_client_error("put_object", service_error_code="AccessDenied", http_status_code=403)
    storage = R2Storage(client, bucket="b", public_base_url="https://cdn")
    with stub, pytest.raises(StorageError, match="AccessDenied"):
        run(storage.upload(b"x", "k.mp3", "audio/mpeg"))


def test_create_r2_client_endpoints() -> None:
    r2 = create_r2_client(account_id="acc", access_key_id="k", secret_access_key="s")
    assert r2.meta.endpoint_url == "https://acc.r2.cloudflarestorage.com"
    local = create_r2_client(
        account_id="acc", access_key_id="k", secret_access_key="s", endpoint="http://localhost:4569"
    )
    assert local.meta.endpoint_url == "http://localhost:4569"


def test_local_storage_writes_file(tmp_path: Path) -> None:
    storage = LocalStorage(tmp_path, public_base_url="http://localhost:8000/media")
    url = run(storage.upload(b"ID3", "audio/radio/x.mp3", "audio/mpeg"))
    assert (tmp_path / "audio/radio/x.mp3").read_bytes() == b"ID3"
    assert url == "http://localhost:8000/media/audio/radio/x.mp3"


def test_local_storage_rejects_path_traversal(tmp_path: Path) -> None:
    storage = LocalStorage(tmp_path / "media", public_base_url="http://x")
    with pytest.raises(StorageError):
        run(storage.upload(b"x", "../escape.mp3", "audio/mpeg"))
