import io
import json
import os
import tempfile
import time
import zipfile
from pathlib import Path

from sqlalchemy.orm import Session

# Import API app modules
import sys
sys.path.append(str(Path(__file__).resolve().parents[1] / "api"))

from app.config import settings
from app.db import Base, SessionLocal, engine
from app.models import Commitment, Snapshot, TimestampProof, User
from app.utils.vault import load_manifest
from app.utils.storage import storage

from opentimestamps.calendar import RemoteCalendar
from opentimestamps.core.op import OpAppend, OpSHA256
from opentimestamps.core.serialize import StreamSerializationContext
from opentimestamps.core.timestamp import DetachedTimestampFile, make_merkle_tree


DEFAULT_CALENDAR_URLS = [
    "https://a.pool.opentimestamps.org",
    "https://b.pool.opentimestamps.org",
    "https://a.pool.eternitywall.com",
    "https://ots.btc.catallaxy.com",
]



def stamp_with_ots(file_path: Path) -> DetachedTimestampFile:
    with open(file_path, "rb") as fd:
        file_timestamp = DetachedTimestampFile.from_fd(OpSHA256(), fd)

    nonce_appended = file_timestamp.timestamp.ops.add(OpAppend(os.urandom(16)))
    merkle_root = nonce_appended.ops.add(OpSHA256())
    merkle_tip = make_merkle_tree([merkle_root])

    merged = 0
    for url in DEFAULT_CALENDAR_URLS:
        try:
            calendar = RemoteCalendar(url)
            calendar_stamp = calendar.submit(merkle_tip.msg, timeout=5)
            merkle_tip.merge(calendar_stamp)
            merged += 1
        except Exception:
            continue

    if merged == 0:
        raise RuntimeError("No calendar accepted the timestamp request")

    return file_timestamp


def create_ots_for_commitment(commitment_hash: str, record_id: str) -> tuple[str, bytes]:
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_path = Path(tmpdir) / f"{record_id}.txt"
        temp_path.write_text(commitment_hash, encoding="utf-8")
        file_timestamp = stamp_with_ots(temp_path)

    buf = io.BytesIO()
    ctx = StreamSerializationContext(buf)
    file_timestamp.serialize(ctx)
    ots_bytes = buf.getvalue()

    key = f"ots/{record_id}.ots"
    ots_ref = storage.upload_bytes(key, ots_bytes, content_type="application/octet-stream", upsert=True)
    return ots_ref, ots_bytes


def build_bundle(
    commitment: Commitment,
    user: User | None,
    snapshot: Snapshot | None,
    ots_key: str,
    ots_bytes: bytes,
) -> str:
    manifest = {
        "commitment_id": commitment.id,
        "snapshot_name": commitment.snapshot_name,
        "snapshot_id": commitment.snapshot_id,
        "commitment_hash": commitment.commitment_hash,
        "hash_alg": commitment.hash_alg,
        "wallet_address": commitment.wallet_address,
        "project_id": commitment.project_id,
        "message": commitment.message,
        "signature": commitment.wallet_signature,
        "status": commitment.status,
        "created_at": commitment.created_at.isoformat() if commitment.created_at else None,
        "email": user.email if user else None,
        "email_verified_at": user.email_verified_at.isoformat() if user and user.email_verified_at else None,
        "calendar_urls": DEFAULT_CALENDAR_URLS,
        "ots_file": Path(ots_key).name,
    }

    readme = (
        "IdeaLock Evidence Bundle\n\n"
        "1) commitment_hash is the hash of canonical manifest + salt + nonce\n"
        "2) proof.ots is the OpenTimestamps proof for commitment_hash\n"
        "3) Verify by re-computing commitment_hash and verifying proof.ots\n"
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2).encode("utf-8"))
        zf.writestr("README.txt", readme.encode("utf-8"))
        zf.writestr("proof.ots", ots_bytes)
        if snapshot and snapshot.manifest_path:
            snapshot_manifest = load_manifest(snapshot.manifest_path)
            zf.writestr("snapshot_manifest.json", json.dumps(snapshot_manifest, ensure_ascii=False, indent=2).encode("utf-8"))

    bundle_bytes = buf.getvalue()
    key = f"bundles/{commitment.id}.zip"
    bundle_ref = storage.upload_bytes(key, bundle_bytes, content_type="application/zip", upsert=True)
    return bundle_ref


def process_commitment(db: Session, commitment: Commitment) -> None:
    user = db.query(User).filter(User.wallet_address == commitment.wallet_address).one_or_none()
    snapshot = None
    if commitment.snapshot_id:
        snapshot = db.query(Snapshot).filter(Snapshot.id == commitment.snapshot_id).one_or_none()

    ots_ref, ots_bytes = create_ots_for_commitment(commitment.commitment_hash, commitment.id)
    bundle_ref = build_bundle(commitment, user, snapshot, ots_ref, ots_bytes)

    proof = TimestampProof(
        commitment_id=commitment.id,
        ots_file_path=ots_ref,
        bundle_path=bundle_ref,
    )
    db.add(proof)
    commitment.status = "PROOF_READY"
    db.commit()


def main():
    Base.metadata.create_all(bind=engine)
    print("Worker started. Waiting for stamp jobs...")
    while True:
        db = SessionLocal()
        try:
            targets = db.query(Commitment).filter(Commitment.status == "STAMPING").all()
            for commitment in targets:
                try:
                    process_commitment(db, commitment)
                    print(f"Stamped commitment {commitment.id}")
                except Exception as exc:
                    commitment.status = "FAILED"
                    db.commit()
                    print(f"Stamp failed for {commitment.id}: {exc}")
        finally:
            db.close()

        time.sleep(5)


if __name__ == "__main__":
    main()
