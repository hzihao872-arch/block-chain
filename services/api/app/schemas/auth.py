from pydantic import BaseModel


class WalletVerifyRequest(BaseModel):
    wallet_address: str
    message: str
    signature: str


class WalletVerifyResponse(BaseModel):
    ok: bool
    user_id: str


class EmailRequest(BaseModel):
    email: str
    wallet_address: str
    commitment_id: str


class EmailResponse(BaseModel):
    ok: bool
