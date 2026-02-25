import smtplib
from email.mime.text import MIMEText

from ..config import settings


def send_magic_link(to_email: str, verify_url: str) -> None:
    subject = "IdeaLock Email Verification"
    body = f"Click to verify your email: {verify_url}"
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_user
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
