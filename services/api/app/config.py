from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[3]
load_dotenv(ROOT_DIR / ".env")

_raw_storage_dir = os.getenv("STORAGE_DIR")
if _raw_storage_dir:
    if os.path.isabs(_raw_storage_dir):
        _storage_dir = _raw_storage_dir
    else:
        _storage_dir = str((ROOT_DIR / _raw_storage_dir).resolve())
else:
    _storage_dir = str(ROOT_DIR / "data")

_raw_db_url = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
if _raw_db_url.startswith("sqlite:///"):
    _db_path = _raw_db_url.replace("sqlite:///", "", 1)
    if not Path(_db_path).is_absolute():
        _db_path = str((ROOT_DIR / _db_path).resolve())
    _database_url = f"sqlite:///{Path(_db_path).as_posix()}"
else:
    _database_url = _raw_db_url


def _bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "dev")
    app_base_url: str = os.getenv("APP_BASE_URL", "http://localhost:3000")
    verify_base_url: str = os.getenv("VERIFY_BASE_URL", "http://localhost:3001")
    api_base_url: str = os.getenv("API_BASE_URL", "http://localhost:8000")
    storage_dir: str = _storage_dir
    storage_backend: str = os.getenv("STORAGE_BACKEND", "local").strip().lower()
    supabase_url: str = os.getenv("SUPABASE_URL", "").strip()
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    supabase_storage_bucket: str = os.getenv("SUPABASE_STORAGE_BUCKET", "idelock").strip()
    signed_url_expires_in: int = int(os.getenv("SIGNED_URL_EXPIRES_IN", "3600"))
    database_url: str = _database_url

    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_pass: str = os.getenv("SMTP_PASS", "")
    smtp_use_tls: bool = _bool(os.getenv("SMTP_USE_TLS", "true"), default=True)
    smtp_from: str = os.getenv("SMTP_FROM", "").strip()
    resend_api_key: str = os.getenv("RESEND_API_KEY", "").strip()
    resend_from: str = os.getenv("RESEND_FROM", "").strip()
    skip_email_verification: bool = _bool(os.getenv("SKIP_EMAIL_VERIFICATION", "false"), default=False)

    server_signing_secret: str = os.getenv("SERVER_SIGNING_SECRET", "")
    vault_encryption_key: str = os.getenv("VAULT_ENCRYPTION_KEY", "")

    allowed_origins: list[str] = field(
        default_factory=lambda: os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001"
        ).split(",")
    )


settings = Settings()
