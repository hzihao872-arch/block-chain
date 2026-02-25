from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Commitment, Snapshot, TimestampProof
from ..schemas.commitments import CommitmentCreateRequest, CommitmentCreateResponse, StampResponse
from ..utils.security import verify_wallet_signature
from ..utils.storage import storage

router = APIRouter()


@router.post("", response_model=CommitmentCreateResponse)
def create_commitment(payload: CommitmentCreateRequest, db: Session = Depends(get_db)):
    if not verify_wallet_signature(payload.wallet_address, payload.message, payload.wallet_signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    existing = db.query(Commitment).filter(Commitment.commitment_hash == payload.commitment_hash).one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Commitment already exists")

    snapshot = None
    if payload.snapshot_id:
        snapshot = db.query(Snapshot).filter(Snapshot.id == payload.snapshot_id).one_or_none()
        if snapshot is None:
            raise HTTPException(status_code=400, detail="Snapshot not found")

    snapshot_name = payload.snapshot_name or (snapshot.name if snapshot else None)

    commitment = Commitment(
        project_id=payload.project_id,
        snapshot_id=payload.snapshot_id,
        snapshot_name=snapshot_name,
        wallet_address=payload.wallet_address,
        commitment_hash=payload.commitment_hash,
        hash_alg=payload.hash_alg,
        wallet_signature=payload.wallet_signature,
        message=payload.message,
        status="EMAIL_PENDING",
    )
    db.add(commitment)
    db.commit()
    db.refresh(commitment)

    return CommitmentCreateResponse(id=commitment.id, status=commitment.status)


@router.post("/{commitment_id}/stamp", response_model=StampResponse)
def stamp_commitment(commitment_id: str, db: Session = Depends(get_db)):
    commitment = db.query(Commitment).filter(Commitment.id == commitment_id).one_or_none()
    if commitment is None:
        raise HTTPException(status_code=404, detail="Not found")

    commitment.status = "STAMPING"
    db.commit()
    return StampResponse(ok=True, status="STAMPING")


@router.get("/{commitment_id}/bundle")
def download_bundle(commitment_id: str, db: Session = Depends(get_db)):
    proof = db.query(TimestampProof).filter(TimestampProof.commitment_id == commitment_id).one_or_none()
    if proof is None:
        raise HTTPException(status_code=404, detail="Bundle not found")
    if storage.is_remote():
        signed_url = storage.create_signed_url(proof.bundle_path)
        if not signed_url:
            raise HTTPException(status_code=500, detail="Failed to create signed URL")
        return RedirectResponse(signed_url)
    return FileResponse(
        storage.resolve_local_path(proof.bundle_path),
        filename=f"{commitment_id}.zip",
        media_type="application/zip",
    )
