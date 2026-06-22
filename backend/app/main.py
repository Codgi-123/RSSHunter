import asyncio
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .database import connect, db, one, rows
from .rss import fetch_feed, scheduler_loop

app = FastAPI(title="ProductHunter API", version="1.0.0")
origins = os.getenv("RSSHUNTER_CORS_ORIGINS", "*").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins if origins != ["*"] else ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class FeedIn(BaseModel):
    name: str
    rss_url: str
    vendor: str
    product: str
    db_type: str
    tags: list[str] = []
    description: str = ""
    enabled: bool = True


class BulkFeedIn(BaseModel):
    feeds: list[FeedIn] = Field(default_factory=list)


class GroupIn(BaseModel):
    name: str
    description: str = ""
    tags: list[str] = []
    default_view: str = "aggregate"
    enabled: bool = True
    feed_ids: list[int] = Field(default_factory=list)


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def next_day(value: str) -> str:
    try:
        return (datetime.fromisoformat(value).date() + timedelta(days=1)).isoformat()
    except ValueError:
        return value


def month_range(month: str) -> tuple[str, str] | None:
    if not month:
        return None
    try:
        start = datetime.strptime(month, "%Y-%m").date().replace(day=1)
    except ValueError:
        return None
    # 下月一号减一天 = 本月最后一天，避免依赖被同名函数遮蔽的 stdlib calendar 模块。
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    last = next_month - timedelta(days=1)
    return start.isoformat(), last.isoformat()


def init_db():
    schema = Path(__file__).with_name("schema.sql").read_text()
    conn = connect()
    conn.executescript(schema)
    conn.commit()
    conn.close()



@app.on_event("startup")
async def startup():
    init_db()
    asyncio.create_task(scheduler_loop())


def feed_row(row):
    if not row:
        return None
    row["tags"] = [x for x in (row.get("tags") or "").split(",") if x]
    row["enabled"] = bool(row["enabled"])
    return row


def entries_where(filters: dict[str, Any]) -> tuple[str, list]:
    where, params = [], []
    if filters.get("feed_id"):
        where.append("e.feed_id = ?"); params.append(filters["feed_id"])
    if filters.get("group_id"):
        where.append("e.feed_id IN (SELECT feed_id FROM group_feeds WHERE group_id = ?)"); params.append(filters["group_id"])
    if filters.get("keyword"):
        where.append("(e.title LIKE ? OR e.summary LIKE ?)"); params += [f"%{filters['keyword']}%", f"%{filters['keyword']}%"]
    for k, col in [("vendor", "f.vendor"), ("product", "f.product"), ("db_type", "f.db_type")]:
        if filters.get(k):
            where.append(f"{col} = ?"); params.append(filters[k])
    if filters.get("start"):
        where.append("e.published_at >= ?"); params.append(filters["start"])
    if filters.get("end"):
        where.append("e.published_at < ?"); params.append(next_day(filters["end"]))
    return (" WHERE " + " AND ".join(where) if where else ""), params


def query_entries(filters: dict[str, Any], limit=50, offset=0):
    sql_where, params = entries_where(filters)
    sql = f"""SELECT e.*, f.name AS feed_name, f.vendor, f.product, f.db_type, f.tags AS feed_tags
              FROM entries e JOIN feeds f ON f.id=e.feed_id {sql_where}
              ORDER BY e.published_at DESC, e.id DESC LIMIT ? OFFSET ?"""
    count_sql = f"SELECT COUNT(*) AS c FROM entries e JOIN feeds f ON f.id=e.feed_id {sql_where}"
    with db() as conn:
        total = one(conn.execute(count_sql, params))["c"]
        data = rows(conn.execute(sql, params + [limit, offset]))
    return {"total": total, "items": data}


def calendar(filters, month: str = ""):
    # month 传 4 位年份（如 "2025"）时按月聚合整年，用于日历「按月」粒度。
    if re.fullmatch(r"\d{4}", month or ""):
        filters = {**filters, "start": f"{month}-01-01", "end": f"{month}-12-31"}
        sql_where, params = entries_where(filters)
        sql = f"SELECT substr(e.published_at,1,7) m, COUNT(*) count FROM entries e JOIN feeds f ON f.id=e.feed_id {sql_where} GROUP BY m"
        with db() as conn:
            grouped = rows(conn.execute(sql, params))
        return [{"date": row["m"], "count": row["count"], "items": []} for row in grouped if row["m"]]
    month_bounds = month_range(month)
    filters = {**filters}
    if month_bounds:
        month_start, month_end = month_bounds
        if not filters.get("start") or filters["start"] < month_start:
            filters["start"] = month_start
        if not filters.get("end") or filters["end"] > month_end:
            filters["end"] = month_end
    result = query_entries(filters, limit=1000)
    days = {}
    for item in result["items"]:
        day = (item["published_at"] or item["created_at"] or "")[:10]
        if day:
            days.setdefault(day, {"date": day, "count": 0, "items": []})
            days[day]["count"] += 1
            days[day]["items"].append(item)
    return list(days.values())




@app.get("/api/overview")
def overview():
    today = datetime.now(timezone.utc).date().isoformat()
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    start = (datetime.now(timezone.utc).date() - timedelta(days=6)).isoformat()
    abnormal_where = "status IN ('fetch_failed','parse_error') OR enabled=0"
    with db() as conn:
        stats = {
            "today_entries": one(conn.execute("SELECT COUNT(*) c FROM entries WHERE date(published_at)=date(?)", (today,)))["c"],
            "feed_count": one(conn.execute("SELECT COUNT(*) c FROM feeds"))["c"],
            "group_count": one(conn.execute("SELECT COUNT(*) c FROM groups"))["c"],
            "abnormal_count": one(conn.execute(f"SELECT COUNT(*) c FROM feeds WHERE {abnormal_where}"))["c"],
        }
        # 与昨日相比的变化量：动态用环比百分比，其余为「今日新增」绝对值。
        yesterday_entries = one(conn.execute("SELECT COUNT(*) c FROM entries WHERE date(published_at)=date(?)", (yesterday,)))["c"]
        deltas = {
            "today_entries_pct": round((stats["today_entries"] - yesterday_entries) / yesterday_entries * 100, 1) if yesterday_entries else None,
            "feed_added": one(conn.execute("SELECT COUNT(*) c FROM feeds WHERE date(created_at)=date(?)", (today,)))["c"],
            "group_added": one(conn.execute("SELECT COUNT(*) c FROM groups WHERE date(created_at)=date(?)", (today,)))["c"],
        }
        trend = rows(conn.execute("SELECT date(published_at) date, COUNT(*) count FROM entries WHERE date(published_at)>=date(?) GROUP BY date(published_at)", (start,)))
        recent_feeds = rows(conn.execute("SELECT *, (SELECT COUNT(*) FROM entries WHERE feed_id=feeds.id AND date(published_at)=date(?)) today_new FROM feeds ORDER BY datetime(latest_item_published_at) DESC LIMIT 5", (today,)))
        groups = rows(conn.execute("SELECT g.*, COUNT(gf.feed_id) feed_count, COALESCE(MAX(e.published_at),'') latest_update FROM groups g LEFT JOIN group_feeds gf ON gf.group_id=g.id LEFT JOIN entries e ON e.feed_id=gf.feed_id GROUP BY g.id ORDER BY g.id LIMIT 5"))
        abnormal = rows(conn.execute(f"SELECT * FROM feeds WHERE {abnormal_where} ORDER BY updated_at DESC LIMIT 8"))
    return {"stats": stats, "deltas": deltas, "trend": trend, "recent_feeds": recent_feeds, "groups": groups, "abnormal_feeds": abnormal}


@app.get("/api/feeds")
def list_feeds(keyword: str = "", vendor: str = "", product: str = "", db_type: str = "", status: str = ""):
    where, params = [], []
    if keyword:
        where.append("(f.name LIKE ? OR f.rss_url LIKE ? OR f.vendor LIKE ? OR f.product LIKE ?)"); params += [f"%{keyword}%"] * 4
    for val, col in [(vendor, "f.vendor"), (product, "f.product"), (db_type, "f.db_type")]:
        if val:
            where.append(f"{col} = ?"); params.append(val)
    if status == "abnormal":
        where.append("(f.status IN ('fetch_failed','parse_error') OR f.enabled=0)")
    elif status == "disabled":
        where.append("f.enabled=0")
    elif status:
        where.append("f.status = ?"); params.append(status)
    sql_where = " WHERE " + " AND ".join(where) if where else ""
    with db() as conn:
        data = rows(conn.execute(f"SELECT f.*, GROUP_CONCAT(g.name) groups FROM feeds f LEFT JOIN group_feeds gf ON gf.feed_id=f.id LEFT JOIN groups g ON g.id=gf.group_id {sql_where} GROUP BY f.id ORDER BY f.id", params))
    return [feed_row(x) for x in data]


@app.post("/api/feeds")
def create_feed(payload: FeedIn):
    with db() as conn:
        cur = conn.execute("INSERT INTO feeds(name,rss_url,vendor,product,db_type,tags,description,enabled,status) VALUES (?,?,?,?,?,?,?,?,?)", (payload.name, payload.rss_url, payload.vendor, payload.product, payload.db_type, ",".join(payload.tags), payload.description, int(payload.enabled), "normal" if payload.enabled else "disabled"))
        return {"id": cur.lastrowid}


@app.get("/api/feeds/{feed_id}")
def get_feed(feed_id: int):
    with db() as conn:
        feed = one(conn.execute("SELECT * FROM feeds WHERE id=?", (feed_id,)))
    if not feed:
        raise HTTPException(404, "订阅源不存在")
    return feed_row(feed)


@app.post("/api/feeds/bulk")
def bulk_create_feeds(payload: BulkFeedIn):
    if not payload.feeds:
        raise HTTPException(400, "请至少导入一条订阅")
    created, skipped = [], []
    with db() as conn:
        for item in payload.feeds:
            exists = one(conn.execute("SELECT id FROM feeds WHERE rss_url=?", (item.rss_url,)))
            if exists:
                skipped.append({"rss_url": item.rss_url, "reason": "RSS URL 已存在"})
                continue
            cur = conn.execute(
                "INSERT INTO feeds(name,rss_url,vendor,product,db_type,tags,description,enabled,status) VALUES (?,?,?,?,?,?,?,?,?)",
                (item.name, item.rss_url, item.vendor, item.product, item.db_type, ",".join(item.tags), item.description, int(item.enabled), "normal" if item.enabled else "disabled"),
            )
            created.append({"id": cur.lastrowid, "name": item.name, "rss_url": item.rss_url})
    return {"created": created, "skipped": skipped, "total": len(payload.feeds)}


@app.put("/api/feeds/{feed_id}")
def update_feed(feed_id: int, payload: FeedIn):
    with db() as conn:
        old = one(conn.execute("SELECT rss_url FROM feeds WHERE id=?", (feed_id,)))
        url_changed = old is not None and old["rss_url"] != payload.rss_url
        conn.execute("UPDATE feeds SET name=?,rss_url=?,vendor=?,product=?,db_type=?,tags=?,description=?,enabled=?,status=?,updated_at=? WHERE id=?", (payload.name, payload.rss_url, payload.vendor, payload.product, payload.db_type, ",".join(payload.tags), payload.description, int(payload.enabled), "normal" if payload.enabled else "disabled", now_iso(), feed_id))
        if url_changed:
            # 换了订阅地址：清空旧地址抓到的历史动态，并重置抓取缓存状态，
            # 让新地址从头抓取，避免新旧条目混在一起。
            conn.execute("DELETE FROM entries WHERE feed_id=?", (feed_id,))
            conn.execute("UPDATE feeds SET etag='',last_modified='',latest_item_published_at=NULL WHERE id=?", (feed_id,))
    return get_feed(feed_id)


@app.delete("/api/feeds/{feed_id}")
def delete_feed(feed_id: int):
    with db() as conn:
        conn.execute("DELETE FROM feeds WHERE id=?", (feed_id,))
    return {"ok": True}


@app.post("/api/feeds/{feed_id}/refresh")
async def refresh_feed(feed_id: int):
    return await fetch_feed(feed_id)


@app.post("/api/feeds/{feed_id}/enable")
def enable_feed(feed_id: int):
    with db() as conn:
        if not one(conn.execute("SELECT id FROM feeds WHERE id=?", (feed_id,))):
            raise HTTPException(404, "订阅源不存在")
        conn.execute("UPDATE feeds SET enabled=1,status='normal',updated_at=? WHERE id=?", (now_iso(), feed_id))
    return get_feed(feed_id)


@app.get("/api/feeds/{feed_id}/entries")
def feed_entries(feed_id: int, keyword: str = "", limit: int = 50, offset: int = 0):
    return query_entries({"feed_id": feed_id, "keyword": keyword}, limit, offset)


@app.get("/api/feeds/{feed_id}/calendar")
def feed_calendar(feed_id: int, month: str = ""):
    return calendar({"feed_id": feed_id}, month)


@app.get("/api/sync-status")
def sync_status():
    with db() as conn:
        last = one(conn.execute("SELECT started_at, result FROM fetch_logs ORDER BY id DESC LIMIT 1"))
    return {"ok": not last or last["result"] != "failed", "last_at": last["started_at"] if last else None}


@app.get("/api/groups")
def list_groups(keyword: str = "", status: str = ""):
    where, params = [], []
    if keyword:
        where.append("(g.name LIKE ? OR g.description LIKE ?)"); params += [f"%{keyword}%"] * 2
    if status:
        where.append("g.enabled = ?"); params.append(1 if status == "enabled" else 0)
    sql_where = " WHERE " + " AND ".join(where) if where else ""
    with db() as conn:
        data = rows(conn.execute(f"""SELECT g.*, COUNT(DISTINCT gf.feed_id) feed_count, COALESCE(MAX(e.published_at),'') latest_update,
            SUM(CASE WHEN date(e.published_at)=date('now') THEN 1 ELSE 0 END) today_new
            FROM groups g LEFT JOIN group_feeds gf ON gf.group_id=g.id LEFT JOIN entries e ON e.feed_id=gf.feed_id {sql_where} GROUP BY g.id ORDER BY g.id""", params))
    for x in data:
        x["enabled"] = bool(x["enabled"]); x["tags"] = [t for t in (x.get("tags") or "").split(",") if t]
    return data


@app.post("/api/groups")
def create_group(payload: GroupIn):
    with db() as conn:
        cur = conn.execute("INSERT INTO groups(name,description,tags,default_view,enabled) VALUES (?,?,?,?,?)", (payload.name, payload.description, ",".join(payload.tags), payload.default_view, int(payload.enabled)))
        gid = cur.lastrowid
        for i, fid in enumerate(payload.feed_ids):
            conn.execute("INSERT INTO group_feeds(group_id,feed_id,sort_order) VALUES (?,?,?)", (gid, fid, i))
    return {"id": gid}


@app.get("/api/groups/{group_id}")
def get_group(group_id: int):
    with db() as conn:
        group = one(conn.execute("SELECT * FROM groups WHERE id=?", (group_id,)))
        if not group:
            raise HTTPException(404, "订阅组不存在")
        feeds = rows(conn.execute("SELECT f.* FROM feeds f JOIN group_feeds gf ON gf.feed_id=f.id WHERE gf.group_id=? ORDER BY gf.sort_order", (group_id,)))
        bad = one(conn.execute(
            "SELECT COUNT(*) c FROM feeds f JOIN group_feeds gf ON gf.feed_id=f.id "
            "WHERE gf.group_id=? AND f.status IN ('fetch_failed','parse_error')",
            (group_id,)
        ))
    group["enabled"] = bool(group["enabled"]); group["tags"] = [t for t in (group.get("tags") or "").split(",") if t]; group["feeds"] = feeds
    group["bad_feed_count"] = bad["c"]
    return group


@app.put("/api/groups/{group_id}")
def update_group(group_id: int, payload: GroupIn):
    with db() as conn:
        conn.execute("UPDATE groups SET name=?,description=?,tags=?,default_view=?,enabled=?,updated_at=? WHERE id=?", (payload.name, payload.description, ",".join(payload.tags), payload.default_view, int(payload.enabled), now_iso(), group_id))
        conn.execute("DELETE FROM group_feeds WHERE group_id=?", (group_id,))
        for i, fid in enumerate(payload.feed_ids):
            conn.execute("INSERT INTO group_feeds(group_id,feed_id,sort_order) VALUES (?,?,?)", (group_id, fid, i))
    return get_group(group_id)


@app.delete("/api/groups/{group_id}")
def delete_group(group_id: int):
    with db() as conn:
        conn.execute("DELETE FROM groups WHERE id=?", (group_id,))
    return {"ok": True}


@app.get("/api/groups/{group_id}/entries")
def group_entries(group_id: int, keyword: str = "", vendor: str = "", product: str = "", start: str = "", end: str = "", limit: int = 50, offset: int = 0):
    return query_entries({"group_id": group_id, "keyword": keyword, "vendor": vendor, "product": product, "start": start, "end": end}, limit, offset)


@app.get("/api/groups/{group_id}/entries-by-source")
def group_entries_by_source(group_id: int, keyword: str = "", vendor: str = "", product: str = "", start: str = "", end: str = ""):
    result = query_entries({"group_id": group_id, "keyword": keyword, "vendor": vendor, "product": product, "start": start, "end": end}, limit=1000)
    bucket = {}
    for item in result["items"]:
        bucket.setdefault(item["feed_id"], {"feed_id": item["feed_id"], "feed_name": item["feed_name"], "vendor": item["vendor"], "product": item["product"], "entries": []})
        bucket[item["feed_id"]]["entries"].append(item)
    return list(bucket.values())


@app.get("/api/groups/{group_id}/calendar")
def group_calendar(group_id: int, keyword: str = "", vendor: str = "", product: str = "", start: str = "", end: str = "", month: str = ""):
    return calendar({"group_id": group_id, "keyword": keyword, "vendor": vendor, "product": product, "start": start, "end": end}, month)


@app.get("/api/entries")
def entries(keyword: str = "", vendor: str = "", product: str = "", db_type: str = "", feed_id: int | None = None, group_id: int | None = None, start: str = "", end: str = "", limit: int = 50, offset: int = 0):
    return query_entries({"keyword": keyword, "vendor": vendor, "product": product, "db_type": db_type, "feed_id": feed_id, "group_id": group_id, "start": start, "end": end}, limit, offset)


@app.get("/api/entries/{entry_id}")
def get_entry(entry_id: int):
    with db() as conn:
        item = one(conn.execute("SELECT e.*, f.name feed_name, f.vendor, f.product, f.db_type FROM entries e JOIN feeds f ON f.id=e.feed_id WHERE e.id=?", (entry_id,)))
    if not item:
        raise HTTPException(404, "条目不存在")
    return item


@app.get("/api/calendar")
def global_calendar(keyword: str = "", vendor: str = "", product: str = "", db_type: str = "", feed_id: int | None = None, group_id: int | None = None, start: str = "", end: str = "", month: str = ""):
    return calendar({"keyword": keyword, "vendor": vendor, "product": product, "db_type": db_type, "feed_id": feed_id, "group_id": group_id, "start": start, "end": end}, month)


@app.get("/api/fetch-logs")
def fetch_logs(feed_id: int | None = None, limit: int = 100):
    where, params = ("WHERE l.feed_id=?", [feed_id]) if feed_id else ("", [])
    with db() as conn:
        return rows(conn.execute(f"SELECT l.*, f.name feed_name FROM fetch_logs l JOIN feeds f ON f.id=l.feed_id {where} ORDER BY datetime(l.started_at) DESC LIMIT ?", params + [limit]))
