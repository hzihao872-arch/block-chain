from pydantic import BaseModel


class VerifyRequest(BaseModel):
    commitment_hash: str
    signature: str
    email_proof: dict
    ots_proof: str


class VerifyResponse(BaseModel):
    valid: bool
    details: dict
