from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.sql import func

from ..db import Base


class Commitment(Base):
    __tablename__ = "commitments"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    snapshot_id = Column(String, ForeignKey("snapshots.id"), nullable=True)
    snapshot_name = Column(String, nullable=True, index=True)
    wallet_address = Column(String, index=True, nullable=False)
    commitment_hash = Column(String, unique=True, index=True, nullable=False)
    hash_alg = Column(String, nullable=False)
    wallet_signature = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="EMAIL_PENDING")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
