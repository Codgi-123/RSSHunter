import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .database import connect, db, one, rows
from .rss import fetch_feed, scheduler_loop

app = FastAPI(title="RSSHunter API", version="1.0.0")
origins = os.getenv("RSSHUNTER_CORS_ORIGINS", "*").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins if origins != ["*"] else ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class FeedIn(BaseModel):
    name: str
    rss_url: str
    vendor: str
    product: str
    db_type: str
    tags: list[str] = []
    website_url: str = ""
    description: str = ""
    enabled: bool = True


class GroupIn(BaseModel):
    name: str
    description: str = ""
    tags: list[str] = []
    default_view: str = "aggregate"
    enabled: bool = True
    feed_ids: list[int] = Field(default_factory=list)


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def init_db():
    schema = Path(__file__).with_name("schema.sql").read_text()
    conn = connect()
    conn.executescript(schema)
    seed(conn)
    conn.commit()
    conn.close()


def seed(conn):
    count = one(conn.execute("SELECT COUNT(*) AS c FROM feeds"))["c"]
    if count:
        return
    feeds = [
        ("腾讯云 TDSQL 动态", "https://rsshub.codgi.xin/tencent/cloud/document/product-updates/向量数据库", "腾讯云", "TDSQL", "向量数据库", "腾讯云,向量数据库", "https://cloud.tencent.com/document/product", "腾讯云数据库产品更新 RSS"),
        ("阿里云 RDS 动态", "https://rsshub.app/aliyun/news", "阿里云", "RDS", "关系型", "云厂商,关系型", "https://www.aliyun.com/product/rds", "阿里云数据库更新动态"),
        ("PostgreSQL 官方动态", "https://www.postgresql.org/about/newsarchive/rss/", "PostgreSQL", "PostgreSQL", "关系型", "PostgreSQL,开源", "https://www.postgresql.org/", "PostgreSQL 官方新闻"),
        ("Redis 官方更新", "https://redis.io/blog/feed/", "Redis", "Redis", "缓存", "Redis,缓存", "https://redis.io/", "Redis 官方博客"),
        ("MongoDB 官方动态", "https://www.mongodb.com/company/blog/rss", "MongoDB", "MongoDB", "文档数据库", "MongoDB,文档", "https://www.mongodb.com/", "MongoDB 官方博客"),
        ("AWS RDS Blog", "https://aws.amazon.com/blogs/database/category/database/amazon-rds/feed/", "AWS", "RDS", "关系型", "AWS,RDS", "https://aws.amazon.com/rds/", "AWS RDS 博客"),
    ]
    for f in feeds:
        conn.execute("INSERT INTO feeds(name, rss_url, vendor, product, db_type, tags, website_url, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", f)
    groups = [
        ("云厂商关系型数据库", "聚合 AWS、阿里云、腾讯云等云厂商关系型数据库动态", "云厂商,关系型", "aggregate", 1, [1, 2, 6]),
        ("缓存数据库动态", "Redis 与云缓存数据库更新", "Redis,缓存", "aggregate", 1, [4]),
        ("PostgreSQL 生态", "PostgreSQL 官方及云厂商兼容产品更新", "PostgreSQL,关系型", "aggregate", 1, [3, 6]),
        ("向量数据库动态", "向量数据库产品公告和云厂商更新", "向量数据库,AI", "calendar", 1, [1]),
        ("文档数据库动态", "MongoDB 及文档数据库生态动态", "MongoDB,文档", "aggregate", 1, [5]),
    ]
    for name, desc, tags, view, enabled, feed_ids in groups:
        cur = conn.execute("INSERT INTO groups(name, description, tags, default_view, enabled) VALUES (?, ?, ?, ?, ?)", (name, desc, tags, view, enabled))
        gid = cur.lastrowid
        for idx, fid in enumerate(feed_ids):
            conn.execute("INSERT INTO group_feeds(group_id, feed_id, sort_order) VALUES (?, ?, ?)", (gid, fid, idx))
    base = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0)
    samples = ["PostgreSQL 17.4 Released", "Aurora PostgreSQL 版本更新", "Cloud SQL for PostgreSQL 新增功能", "Redis 8 发布候选版本", "MongoDB Atlas Search 更新", "腾讯云向量数据库能力升级", "AWS RDS 性能洞察更新"]
    for i, title in enumerate(samples * 4):
        feed_id = (i % 6) + 1
        published = (base - timedelta(days=i % 12, hours=i)).isoformat()
        conn.execute("INSERT OR IGNORE INTO entries(feed_id, guid, title, link, summary, published_at) VALUES (?, ?, ?, ?, ?, ?)", (feed_id, f"seed-{i}", title, "https://example.com/news/" + str(i), "数据库产品更新摘要，包含版本能力、性能、安全或兼容性改进。", published))
    conn.execute("UPDATE feeds SET latest_item_published_at=(SELECT MAX(published_at) FROM entries WHERE entries.feed_id=feeds.id), last_fetched_at=?", (now_iso(),))


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


def query_entries(filters: dict[str, Any], limit=50, offset=0):
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
        where.append("date(e.published_at) >= date(?)"); params.append(filters["start"])
    if filters.get("end"):
        where.append("date(e.published_at) <= date(?)"); params.append(filters["end"])
    sql_where = " WHERE " + " AND ".join(where) if where else ""
    sql = f"""SELECT e.*, f.name AS feed_name, f.vendor, f.product, f.db_type
              FROM entries e JOIN feeds f ON f.id=e.feed_id {sql_where}
              ORDER BY datetime(e.published_at) DESC LIMIT ? OFFSET ?"""
    count_sql = f"SELECT COUNT(*) AS c FROM entries e JOIN feeds f ON f.id=e.feed_id {sql_where}"
    with db() as conn:
        total = one(conn.execute(count_sql, params))["c"]
        data = rows(conn.execute(sql, params + [limit, offset]))
    return {"total": total, "items": data}


def calendar(filters):
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
    start = (datetime.now(timezone.utc).date() - timedelta(days=6)).isoformat()
    with db() as conn:
        stats = {
            "today_entries": one(conn.execute("SELECT COUNT(*) c FROM entries WHERE date(created_at)=date(?)", (today,)))["c"],
            "feed_count": one(conn.execute("SELECT COUNT(*) c FROM feeds"))["c"],
            "group_count": one(conn.execute("SELECT COUNT(*) c FROM groups"))["c"],
            "abnormal_count": one(conn.execute("SELECT COUNT(*) c FROM feeds WHERE status IN ('fetch_failed','parse_error') OR enabled=0"))["c"],
        }
        trend = rows(conn.execute("SELECT date(created_at) date, COUNT(*) count FROM entries WHERE date(created_at)>=date(?) GROUP BY date(created_at)", (start,)))
        recent_feeds = rows(conn.execute("SELECT *, (SELECT COUNT(*) FROM entries WHERE feed_id=feeds.id AND date(created_at)=date(?)) today_new FROM feeds ORDER BY datetime(latest_item_published_at) DESC LIMIT 5", (today,)))
        groups = rows(conn.execute("SELECT g.*, COUNT(gf.feed_id) feed_count, COALESCE(MAX(e.published_at),'') latest_update FROM groups g LEFT JOIN group_feeds gf ON gf.group_id=g.id LEFT JOIN entries e ON e.feed_id=gf.feed_id GROUP BY g.id ORDER BY g.id LIMIT 5"))
        abnormal = rows(conn.execute("SELECT * FROM feeds WHERE status IN ('fetch_failed','parse_error') OR enabled=0 ORDER BY updated_at DESC LIMIT 8"))
    return {"stats": stats, "trend": trend, "recent_feeds": recent_feeds, "groups": groups, "abnormal_feeds": abnormal}


@app.get("/api/feeds")
def list_feeds(keyword: str = "", vendor: str = "", product: str = "", db_type: str = "", status: str = ""):
    where, params = [], []
    if keyword:
        where.append("(name LIKE ? OR rss_url LIKE ? OR vendor LIKE ? OR product LIKE ?)"); params += [f"%{keyword}%"] * 4
    for val, col in [(vendor, "vendor"), (product, "product"), (db_type, "db_type"), (status, "status")]:
        if val:
            where.append(f"{col} = ?"); params.append(val)
    sql_where = " WHERE " + " AND ".join(where) if where else ""
    with db() as conn:
        data = rows(conn.execute(f"SELECT f.*, GROUP_CONCAT(g.name) groups FROM feeds f LEFT JOIN group_feeds gf ON gf.feed_id=f.id LEFT JOIN groups g ON g.id=gf.group_id {sql_where} GROUP BY f.id ORDER BY f.id", params))
    return [feed_row(x) for x in data]


@app.post("/api/feeds")
def create_feed(payload: FeedIn):
    with db() as conn:
        cur = conn.execute("INSERT INTO feeds(name,rss_url,vendor,product,db_type,tags,website_url,description,enabled,status) VALUES (?,?,?,?,?,?,?,?,?,?)", (payload.name, payload.rss_url, payload.vendor, payload.product, payload.db_type, ",".join(payload.tags), payload.website_url, payload.description, int(payload.enabled), "normal" if payload.enabled else "disabled"))
        return {"id": cur.lastrowid}


@app.get("/api/feeds/{feed_id}")
def get_feed(feed_id: int):
    with db() as conn:
        feed = one(conn.execute("SELECT * FROM feeds WHERE id=?", (feed_id,)))
    if not feed:
        raise HTTPException(404, "订阅源不存在")
    return feed_row(feed)


@app.put("/api/feeds/{feed_id}")
def update_feed(feed_id: int, payload: FeedIn):
    with db() as conn:
        conn.execute("UPDATE feeds SET name=?,rss_url=?,vendor=?,product=?,db_type=?,tags=?,website_url=?,description=?,enabled=?,status=?,updated_at=? WHERE id=?", (payload.name, payload.rss_url, payload.vendor, payload.product, payload.db_type, ",".join(payload.tags), payload.website_url, payload.description, int(payload.enabled), "normal" if payload.enabled else "disabled", now_iso(), feed_id))
    return get_feed(feed_id)


@app.delete("/api/feeds/{feed_id}")
def delete_feed(feed_id: int):
    with db() as conn:
        conn.execute("DELETE FROM feeds WHERE id=?", (feed_id,))
    return {"ok": True}


@app.post("/api/feeds/{feed_id}/refresh")
async def refresh_feed(feed_id: int):
    return await fetch_feed(feed_id)


@app.get("/api/feeds/{feed_id}/entries")
def feed_entries(feed_id: int, keyword: str = "", limit: int = 50, offset: int = 0):
    return query_entries({"feed_id": feed_id, "keyword": keyword}, limit, offset)


@app.get("/api/feeds/{feed_id}/calendar")
def feed_calendar(feed_id: int):
    return calendar({"feed_id": feed_id})


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
            SUM(CASE WHEN date(e.created_at)=date('now') THEN 1 ELSE 0 END) today_new
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
        feeds = rows(conn.execute("SELECT f.* FROM feeds f JOIN group_feeds gf ON gf.feed_id=f.id WHERE gf.group_id=? ORDER BY gf.sort_order", (group_id,)))
    if not group:
        raise HTTPException(404, "订阅组不存在")
    group["enabled"] = bool(group["enabled"]); group["tags"] = [t for t in (group.get("tags") or "").split(",") if t]; group["feeds"] = feeds
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
def group_entries(group_id: int, keyword: str = "", vendor: str = "", product: str = "", limit: int = 50, offset: int = 0):
    return query_entries({"group_id": group_id, "keyword": keyword, "vendor": vendor, "product": product}, limit, offset)


@app.get("/api/groups/{group_id}/entries-by-source")
def group_entries_by_source(group_id: int):
    result = query_entries({"group_id": group_id}, limit=1000)
    bucket = {}
    for item in result["items"]:
        bucket.setdefault(item["feed_id"], {"feed_id": item["feed_id"], "feed_name": item["feed_name"], "vendor": item["vendor"], "product": item["product"], "entries": []})
        bucket[item["feed_id"]]["entries"].append(item)
    return list(bucket.values())


@app.get("/api/groups/{group_id}/calendar")
def group_calendar(group_id: int):
    return calendar({"group_id": group_id})


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
def global_calendar(keyword: str = "", vendor: str = "", product: str = "", db_type: str = "", feed_id: int | None = None, group_id: int | None = None):
    return calendar({"keyword": keyword, "vendor": vendor, "product": product, "db_type": db_type, "feed_id": feed_id, "group_id": group_id})


@app.get("/api/fetch-logs")
def fetch_logs(feed_id: int | None = None, limit: int = 100):
    where, params = ("WHERE l.feed_id=?", [feed_id]) if feed_id else ("", [])
    with db() as conn:
        return rows(conn.execute(f"SELECT l.*, f.name feed_name FROM fetch_logs l JOIN feeds f ON f.id=l.feed_id {where} ORDER BY datetime(l.started_at) DESC LIMIT ?", params + [limit]))
