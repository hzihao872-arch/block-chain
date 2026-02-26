from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

_connect_args = {}
if settings.database_url.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}
elif settings.database_url.startswith("postgresql"):
    # Supabase pooler (PgBouncer) can break server-side prepared statements.
    # Disable prepares to avoid DuplicatePreparedStatement errors.
    _connect_args = {"prepare_threshold": 0}

engine = create_engine(settings.database_url, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
