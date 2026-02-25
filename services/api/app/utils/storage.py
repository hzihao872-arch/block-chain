from __future__ import annotations

from pathlib import Path
from typing import Optional

from storage3 import SyncStorageClient

from ..config import settings


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


class StorageClient:
    def __init__(self) -> None:
        self.backend = settings.storage_backend
        self._bucket = None

        if self.backend == "supabase":
            if not settings.supabase_url or not settings.supabase_service_role_key:
                raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
            storage_url = settings.supabase_url.rstrip("/") + "/storage/v1"
            headers = {
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            }
            client = SyncStorageClient(storage_url, headers)
            self._bucket = client.from_(settings.supabase_storage_bucket)

    def is_remote(self) -> bool:
        return self.backend == "supabase"

    def local_path(self, key: str) -> Path:
        return Path(settings.storage_dir).resolve() / key

    def resolve_local_path(self, ref: str) -> Path:
        path = Path(ref)
        if path.is_absolute():
            return path
        return self.local_path(ref)

    def upload_bytes(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        upsert: bool = True,
    ) -> str:
        if not self.is_remote():
            path = self.local_path(key)
            _ensure_dir(path.parent)
            path.write_bytes(data)
            return str(path)

        options: dict[str, str] = {"content-type": content_type}
        if upsert:
            options["upsert"] = "true"
        self._bucket.upload(key, data, options)
        return key

    def download_bytes(self, key: str) -> bytes:
        if not self.is_remote():
            return self.resolve_local_path(key).read_bytes()

        return self._bucket.download(key)

    def create_signed_url(self, key: str, expires_in: Optional[int] = None) -> Optional[str]:
        if not self.is_remote():
            return None
        expires = expires_in or settings.signed_url_expires_in
        result = self._bucket.create_signed_url(key, expires, {"download": True})
        return result.get("signedURL")

    def exists(self, key: str) -> bool:
        if not self.is_remote():
            return self.resolve_local_path(key).exists()
        return bool(self._bucket.exists(key))


storage = StorageClient()
