import base64
import hashlib
import hmac
import time

from eth_account import Account
from eth_account.messages import encode_defunct


def verify_wallet_signature(wallet_address: str, message: str, signature: str) -> bool:
    if not wallet_address or not message or not signature:
        return False
    try:
        recovered = Account.recover_message(encode_defunct(text=message), signature=signature)
    except Exception:
        return False
    return recovered.lower() == wallet_address.lower()


def create_email_token(
    email: str,
    wallet_address: str,
    commitment_id: str,
    secret: str,
    expires_in: int = 900,
) -> str:
    if not secret:
        raise ValueError("SERVER_SIGNING_SECRET not set")
    exp = int(time.time()) + expires_in
    payload = f"{email}|{wallet_address}|{commitment_id}|{exp}".encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
    token = base64.urlsafe_b64encode(payload + b"|" + sig).decode("utf-8")
    return token


def verify_email_token(token: str, secret: str) -> dict:
    raw = base64.urlsafe_b64decode(token.encode("utf-8"))
    parts = raw.split(b"|")
    if len(parts) < 5:
        raise ValueError("Invalid token")
    email = parts[0].decode("utf-8")
    wallet_address = parts[1].decode("utf-8")
    commitment_id = parts[2].decode("utf-8")
    exp = int(parts[3].decode("utf-8"))
    sig = b"|".join(parts[4:])
    payload = f"{email}|{wallet_address}|{commitment_id}|{exp}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("Invalid signature")
    if time.time() > exp:
        raise ValueError("Token expired")
    return {
        "email": email,
        "wallet_address": wallet_address,
        "commitment_id": commitment_id,
        "exp": exp,
    }
