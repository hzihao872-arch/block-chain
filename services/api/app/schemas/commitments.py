from typing import Optional

from pydantic import BaseModel


class CommitmentCreateRequest(BaseModel):
    project_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    snapshot_name: Optional[str] = None
    wallet_address: str
    commitment_hash: str
    hash_alg: str = "sha256"
    message: str
    wallet_signature: str


class CommitmentCreateResponse(BaseModel):
    id: str
    status: str


class StampResponse(BaseModel):
    ok: bool
    status: str
