import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Snapshot
from ..utils.vault import (
    build_manifest,
    build_snapshot_bundle_bytes,
    canonical_manifest,
    load_manifest,
    save_manifest,
    store_object,
    get_fernet,
)
from ..utils.storage import storage


router = APIRouter()
OBJECTS_PREFIX = "vault/objects"
MANIFESTS_PREFIX = "vault/manifests"
EXPORTS_PREFIX = "vault/exports"


@router.post("")
async def create_snapshot(
    files: list[UploadFile] = File(...),
    file_meta: str = Form("[]"),
    project_id: str | None = Form(None),
    snapshot_name: str | None = Form(None),
    db: Session = Depends(get_db),
):
    try:
        meta_list = json.loads(file_meta)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file_meta JSON")

    if len(meta_list) != len(files):
        raise HTTPException(status_code=400, detail="file_meta length mismatch")

    fernet = get_fernet(settings.vault_encryption_key)

    snapshot = Snapshot(project_id=project_id, name=snapshot_name, manifest_path="")
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    file_entries: list[dict] = []
    for idx, upload in enumerate(files):
        data = await upload.read()
        digest = store_object(data, OBJECTS_PREFIX, fernet)

        meta = meta_list[idx] if isinstance(meta_list, list) else {}
        rel_path = meta.get("path") if isinstance(meta, dict) else None
        if not rel_path:
            rel_path = upload.filename or f"file_{idx}"

        file_entries.append(
            {
                "path": rel_path,
                "size": len(data),
                "hash": digest,
                "last_modified": meta.get("last_modified") if isinstance(meta, dict) else None,
            }
        )

    manifest = build_manifest(snapshot.id, snapshot_name, project_id, file_entries)
    manifest["created_at"] = snapshot.created_at.isoformat() if snapshot.created_at else None

    manifest_ref = save_manifest(manifest, MANIFESTS_PREFIX, snapshot.id)
    snapshot.manifest_path = str(manifest_ref)
    snapshot.file_count = manifest["file_count"]
    snapshot.total_size = manifest["total_size"]
    db.commit()

    return {
        "snapshot_id": snapshot.id,
        "snapshot_name": snapshot.name,
        "file_count": snapshot.file_count,
        "total_size": snapshot.total_size,
        "manifest": manifest,
        "manifest_canonical": canonical_manifest(manifest),
    }


@router.get("/{snapshot_id}/manifest")
def get_manifest(snapshot_id: str, db: Session = Depends(get_db)):
    snapshot = db.query(Snapshot).filter(Snapshot.id == snapshot_id).one_or_none()
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    manifest = load_manifest(snapshot.manifest_path)
    return manifest


@router.get("/{snapshot_id}/export")
def export_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    snapshot = db.query(Snapshot).filter(Snapshot.id == snapshot_id).one_or_none()
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    fernet = get_fernet(settings.vault_encryption_key)
    manifest = load_manifest(snapshot.manifest_path)
    bundle_bytes = build_snapshot_bundle_bytes(manifest, OBJECTS_PREFIX, fernet)

    export_key = f"{EXPORTS_PREFIX}/{snapshot_id}.zip"
    stored_ref = storage.upload_bytes(export_key, bundle_bytes, content_type="application/zip", upsert=True)

    if storage.is_remote():
        signed_url = storage.create_signed_url(export_key)
        if not signed_url:
            raise HTTPException(status_code=500, detail="Failed to create signed URL")
        return RedirectResponse(signed_url)

    return FileResponse(
        storage.resolve_local_path(stored_ref),
        filename=f"{snapshot_id}.zip",
        media_type="application/zip",
    )
