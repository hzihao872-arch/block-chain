import smtplib
from email.mime.text import MIMEText

import httpx

from ..config import settings


def send_magic_link(to_email: str, verify_url: str) -> None:
    subject = "IdeaLock Email Verification"
    body = f"Click to verify your email: {verify_url}"

    if settings.resend_api_key:
        from_addr = settings.resend_from or settings.smtp_from or settings.smtp_user
        if not from_addr:
            raise RuntimeError("RESEND_FROM or SMTP_FROM must be set when using Resend API")
        payload = {
            "from": from_addr,
            "to": [to_email],
            "subject": subject,
            "text": body,
        }
        headers = {
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=15) as client:
            res = client.post("https://api.resend.com/emails", json=payload, headers=headers)
        if res.status_code >= 300:
            raise RuntimeError(f"Resend API error: {res.status_code} {res.text}")
        return

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    from_addr = settings.smtp_from or settings.smtp_user
    msg["From"] = from_addr
    msg["To"] = to_email

    if settings.smtp_use_tls:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(msg)
    else:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(msg)