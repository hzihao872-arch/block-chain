from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from ..db import Base


class EvidencePackage(Base):
    __tablename__ = "evidence_packages"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    commitment_id = Column(String, ForeignKey("commitments.id"), nullable=False, index=True)
    snapshot_id = Column(String, ForeignKey("snapshots.id"), nullable=True, index=True)
    snapshot_name = Column(String, nullable=True, index=True)
    package_path = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
