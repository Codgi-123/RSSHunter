import asyncio
import os
import re
from calendar import timegm
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import feedparser
import httpx

from .database import db, one, rows


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_date(value: Any) -> str | None:
    if not value:
        return None
    if hasattr(value, "tm_year"):
        try:
            return datetime.fromtimestamp(timegm(value), timezone.utc).replace(microsecond=0).isoformat()
        except Exception:
            return None
    if isinstance(value, str):
        try:
            return parsedate_to_datetime(value).astimezone(timezone.utc).replace(microsecond=0).isoformat()
        except Exception:
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).replace(microsecond=0).isoformat()
            except Exception:
                return None
    return None


def date_iso(year: int, month: int, day: int) -> str | None:
    try:
        return datetime(year, month, day, tzinfo=timezone(timedelta(hours=8))).astimezone(timezone.utc).replace(microsecond=0).isoformat()
    except ValueError:
        return None


def infer_date_from_text(*values: Any) -> str | None:
    text = " ".join(str(value or "") for value in values)
    patterns = [
        r"(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)",
        r"(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})",
        r"(20\d{2})年(\d{1,2})月(\d{1,2})日",
        r"(20\d{2})年.*?-(\d{1,2})-(\d{1,2})(?:\D|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            parsed = date_iso(*(int(item) for item in match.groups()))
            if parsed:
                return parsed
    month_match = re.search(r"(20\d{2})年(\d{1,2})月", text)
    if month_match:
        return date_iso(int(month_match.group(1)), int(month_match.group(2)), 1)
    return None


def entry_published_at(item: Any) -> str | None:
    for key in ("published", "updated", "created", "published_parsed", "updated_parsed", "created_parsed"):
        parsed = parse_date(item.get(key))
        if parsed:
            return parsed
    return infer_date_from_text(item.get("title"), item.get("id"), item.get("guid"), item.get("link"), item.get("summary"))


async def fetch_feed(feed_id: int) -> dict:
    started_at = now_iso()
    with db() as conn:
        feed = one(conn.execute("SELECT * FROM feeds WHERE id = ?", (feed_id,)))
    if not feed:
        raise ValueError("订阅源不存在")
    if not feed["enabled"]:
        return {"result": "skipped", "new_entries": 0, "total_entries": 0}

    new_entries = 0
    total_entries = 0
    error = ""
    status = "normal"
    try:
        headers = {"User-Agent": "RSSHunter/1.0"}
        if feed.get("etag"):
            headers["If-None-Match"] = feed["etag"]
        if feed.get("last_modified"):
            headers["If-Modified-Since"] = feed["last_modified"]
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            response = await client.get(feed["rss_url"], headers=headers)
            if response.status_code == 304:
                with db() as conn:
                    conn.execute(
                        "UPDATE feeds SET status = 'normal', last_error = '', last_fetched_at = ?, updated_at = ? WHERE id = ?",
                        (started_at, started_at, feed_id),
                    )
                    conn.execute(
                        "INSERT INTO fetch_logs(feed_id, started_at, result, new_entries, total_entries, error_message) VALUES (?, ?, 'not_modified', 0, 0, '')",
                        (feed_id, started_at),
                    )
                return {"result": "not_modified", "new_entries": 0, "total_entries": 0}
            response.raise_for_status()
        parsed = feedparser.parse(response.content)
        if parsed.bozo and not parsed.entries:
            status = "parse_error"
            raise ValueError(str(parsed.bozo_exception))
        latest = None
        with db() as conn:
            for item in parsed.entries:
                total_entries += 1
                guid = item.get("id") or item.get("guid") or item.get("link") or item.get("title")
                title = item.get("title") or "未命名动态"
                link = item.get("link") or ""
                summary = item.get("summary") or item.get("description") or ""
                published = entry_published_at(item)
                if published:
                    latest = max(latest, published) if latest else published
                cur = conn.execute(
                    """INSERT OR IGNORE INTO entries(feed_id, guid, title, link, summary, published_at, fetched_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (feed_id, guid, title, link, summary, published, started_at),
                )
                new_entries += cur.rowcount
            conn.execute(
                """UPDATE feeds
                   SET status = 'normal',
                       last_error = '',
                       etag = COALESCE(NULLIF(?, ''), etag),
                       last_modified = COALESCE(NULLIF(?, ''), last_modified),
                       latest_item_published_at = COALESCE(?, latest_item_published_at),
                       last_fetched_at = ?,
                       updated_at = ?
                   WHERE id = ?""",
                (response.headers.get("etag", ""), response.headers.get("last-modified", ""), latest, started_at, started_at, feed_id),
            )
            conn.execute(
                "INSERT INTO fetch_logs(feed_id, started_at, result, new_entries, total_entries, error_message) VALUES (?, ?, 'success', ?, ?, '')",
                (feed_id, started_at, new_entries, total_entries),
            )
        return {"result": "success", "new_entries": new_entries, "total_entries": total_entries}
    except httpx.HTTPError as exc:
        status = "fetch_failed"
        error = str(exc)
    except Exception as exc:
        if status != "parse_error":
            status = "fetch_failed"
        error = str(exc)

    with db() as conn:
        conn.execute("UPDATE feeds SET status = ?, last_error = ?, last_fetched_at = ?, updated_at = ? WHERE id = ?", (status, error, started_at, started_at, feed_id))
        conn.execute(
            "INSERT INTO fetch_logs(feed_id, started_at, result, new_entries, total_entries, error_message) VALUES (?, ?, 'failed', 0, ?, ?)",
            (feed_id, started_at, total_entries, error),
        )
    return {"result": "failed", "new_entries": 0, "total_entries": total_entries, "error": error}


async def refresh_enabled_feeds():
    with db() as conn:
        feeds = rows(conn.execute("SELECT id FROM feeds WHERE enabled = 1"))
    for feed in feeds:
        await fetch_feed(feed["id"])


async def scheduler_loop():
    interval = int(os.getenv("RSSHUNTER_FETCH_INTERVAL_SECONDS", "900"))
    while True:
        await refresh_enabled_feeds()
        await asyncio.sleep(interval)
