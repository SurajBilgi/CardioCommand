"""
Database setup — SQLite via SQLAlchemy.
DB file: backend/cardiocommand.db  (auto-created on first run)
"""
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DEFAULT_DB_PATH = Path(__file__).with_name("cardiocommand.db").resolve()
DB_PATH = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

engine = create_engine(
    DB_PATH,
    connect_args={"check_same_thread": False},  # SQLite needs this for FastAPI
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Called on startup to create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)
