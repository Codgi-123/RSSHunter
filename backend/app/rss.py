import asyncio
import os
from datetime import datetime, timezone
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
    if isinstance(value, str):
        try:
            return parsedate_to_datetime(value).astimezone(timezone.utc).replace(microsecond=0).isoformat()
        except Exception:
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).replace(microsecond=0).isoformat()
            except Exception:
                return None
    return None


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
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            response = await client.get(feed["rss_url"], headers={"User-Agent": "RSSHunter/1.0"})
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
                published = parse_date(item.get("published") or item.get("updated") or item.get("created")) or now_iso()
                latest = max(latest, published) if latest else published
                cur = conn.execute(
                    """INSERT OR IGNORE INTO entries(feed_id, guid, title, link, summary, published_at, fetched_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (feed_id, guid, title, link, summary, published, started_at),
                )
                new_entries += cur.rowcount
            conn.execute(
                "UPDATE feeds SET status = 'normal', last_error = '', latest_item_published_at = COALESCE(?, latest_item_published_at), last_fetched_at = ?, updated_at = ? WHERE id = ?",
                (latest, started_at, started_at, feed_id),
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
