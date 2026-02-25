from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from ..db import Base


class TimestampProof(Base):
    __tablename__ = "timestamp_proofs"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    commitment_id = Column(String, ForeignKey("commitments.id"), nullable=False)
    ots_file_path = Column(String, nullable=False)
    bundle_path = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    verified_at = Column(DateTime, nullable=True)
