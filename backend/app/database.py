import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.getenv("RSSHUNTER_DB", Path(__file__).resolve().parents[1] / "data" / "rsshunter.db"))


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def rows(cursor):
    return [dict(row) for row in cursor.fetchall()]


def one(cursor):
    row = cursor.fetchone()
    return dict(row) if row else None
