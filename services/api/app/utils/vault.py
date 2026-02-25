from __future__ import annotations

import hashlib
import io
import json
import re
import zipfile
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken

from .storage import storage


def _safe_relpath(path_value: str) -> str:
    normalized = path_value.replace("\\", "/")
    normalized = re.sub(r"^[A-Za-z]:", "", normalized)
    normalized = normalized.lstrip("/")
    normalized = normalized.replace("../", "").replace("..\\", "")
    return normalized or "unnamed"


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def get_fernet(key: str | None) -> Fernet | None:
    if not key:
        return None
    return Fernet(key.encode("utf-8"))


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def store_object(data: bytes, objects_prefix: str, fernet: Fernet | None) -> str:
    digest = _sha256(data)
    key = f"{objects_prefix}/{digest}".lstrip("/")
    if storage.exists(key):
        return digest

    payload = fernet.encrypt(data) if fernet else data
    storage.upload_bytes(key, payload, content_type="application/octet-stream", upsert=True)
    return digest


def load_object(digest: str, objects_prefix: str, fernet: Fernet | None) -> bytes:
    key = f"{objects_prefix}/{digest}".lstrip("/")
    data = storage.download_bytes(key)
    if not fernet:
        return data
    try:
        return fernet.decrypt(data)
    except InvalidToken as exc:
        raise ValueError("Invalid vault encryption key") from exc


def build_manifest(
    snapshot_id: str,
    snapshot_name: str | None,
    project_id: str | None,
    files: list[dict],
) -> dict:
    files_sorted = sorted(files, key=lambda item: item.get("path", ""))
    total_size = sum(item.get("size", 0) for item in files_sorted)
    return {
        "snapshot_id": snapshot_id,
        "snapshot_name": snapshot_name,
        "project_id": project_id,
        "file_count": len(files_sorted),
        "total_size": total_size,
        "hash_alg": "sha256",
        "files": files_sorted,
    }


def save_manifest(manifest: dict, manifests_prefix: str, snapshot_id: str) -> str:
    key = f"{manifests_prefix}/{snapshot_id}.json".lstrip("/")
    payload = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
    return storage.upload_bytes(key, payload, content_type="application/json", upsert=True)


def load_manifest(manifest_ref: str | Path) -> dict:
    if isinstance(manifest_ref, Path):
        return json.loads(manifest_ref.read_text(encoding="utf-8"))

    path = Path(manifest_ref)
    if path.is_absolute() or path.exists():
        return json.loads(path.read_text(encoding="utf-8"))

    data = storage.download_bytes(manifest_ref)
    return json.loads(data.decode("utf-8"))


def canonical_manifest(manifest: dict) -> str:
    return json.dumps(manifest, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def build_snapshot_bundle_bytes(
    manifest: dict,
    objects_prefix: str,
    fernet: Fernet | None,
) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for item in manifest.get("files", []):
            rel_path = _safe_relpath(str(item.get("path", "")))
            digest = item.get("hash")
            if not digest:
                continue
            data = load_object(digest, objects_prefix, fernet)
            zf.writestr(rel_path, data)

        zf.writestr(
            "snapshot_manifest.json",
            json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"),
        )

    return buf.getvalue()
