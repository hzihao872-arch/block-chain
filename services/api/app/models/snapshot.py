from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from ..db import Base


class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    name = Column(String, nullable=True, index=True)
    manifest_path = Column(String, nullable=False)
    file_count = Column(Integer, nullable=False, default=0)
    total_size = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
