from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Commitment, User
from ..schemas.auth import EmailRequest, EmailResponse, WalletVerifyRequest, WalletVerifyResponse
from ..utils.mailer import send_magic_link
from ..utils.security import create_email_token, verify_email_token, verify_wallet_signature

router = APIRouter()


@router.post("/wallet/verify", response_model=WalletVerifyResponse)
def wallet_verify(payload: WalletVerifyRequest, db: Session = Depends(get_db)):
    if not verify_wallet_signature(payload.wallet_address, payload.message, payload.signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    user = db.query(User).filter(User.wallet_address == payload.wallet_address).one_or_none()
    if user is None:
        user = User(wallet_address=payload.wallet_address)
        db.add(user)
        db.commit()
        db.refresh(user)

    return WalletVerifyResponse(ok=True, user_id=user.id)


@router.post("/email/request", response_model=EmailResponse)
def email_request(payload: EmailRequest, db: Session = Depends(get_db)):
    if not settings.server_signing_secret:
        raise HTTPException(status_code=500, detail="SERVER_SIGNING_SECRET not set")
    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_pass:
        raise HTTPException(status_code=500, detail="SMTP not configured")

    commitment = (
        db.query(Commitment)
        .filter(Commitment.id == payload.commitment_id)
        .one_or_none()
    )
    if commitment is None:
        raise HTTPException(status_code=404, detail="Commitment not found")
    if commitment.wallet_address.lower() != payload.wallet_address.lower():
        raise HTTPException(status_code=400, detail="Wallet mismatch")

    user = db.query(User).filter(User.wallet_address == payload.wallet_address).one_or_none()
    if user is None:
        user = User(wallet_address=payload.wallet_address, email=payload.email)
        db.add(user)
    else:
        user.email = payload.email

    db.commit()

    token = create_email_token(
        payload.email,
        payload.wallet_address,
        payload.commitment_id,
        settings.server_signing_secret,
    )
    verify_url = f"{settings.app_base_url}/email/confirm?token={token}"
    send_magic_link(payload.email, verify_url)
    return EmailResponse(ok=True)


@router.get("/email/confirm")
def email_confirm(token: str, db: Session = Depends(get_db)):
    if not settings.server_signing_secret:
        raise HTTPException(status_code=500, detail="SERVER_SIGNING_SECRET not set")

    data = verify_email_token(token, settings.server_signing_secret)

    user = db.query(User).filter(User.wallet_address == data["wallet_address"]).one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.email = data["email"]
    user.email_verified_at = datetime.now(timezone.utc)

    commitment = db.query(Commitment).filter(Commitment.id == data["commitment_id"]).one_or_none()
    if commitment:
        commitment.status = "STAMPING"

    db.commit()

    return {"ok": True, "commitment_id": data["commitment_id"]}
