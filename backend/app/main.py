import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from .database import connect, db, one, rows
from .rss import fetch_feed, scheduler_loop

app = FastAPI(title="ProductHunter API", version="1.0.0")
origins = os.getenv("RSSHUNTER_CORS_ORIGINS", "*").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins if origins != ["*"] else ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

SKILL_PUBLIC_DIR = Path(__file__).with_name("skill_public")
SKILL_PACKAGE_DIR = SKILL_PUBLIC_DIR / "rss-group-digest"
SKILL_PACKAGE_FILES = {
    "SKILL.md",
    "agents/openai.yaml",
    "references/config-schema.md",
    "references/conversation-flow.md",
    "references/prompt-templates.md",
}


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
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start.isoformat(), (next_month - timedelta(days=1)).isoformat()


def init_db():
    schema = Path(__file__).with_name("schema.sql").read_text()
    conn = connect()
    conn.executescript(schema)
    migrate(conn)
    seed(conn)
    migrate(conn)
    conn.commit()
    conn.close()


TENCENT_VECTOR_RSS_URL = "https://rsshub.codgi.xin/tencent/cloud/document/product-updates/向量数据库"

AWS_DATABASE_FEEDS = [
    ("Amazon Aurora 动态", "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/auroraupdates.rss", "AWS", "Amazon Aurora", "关系型", "AWS,Amazon Aurora,关系型", "AWS Amazon Aurora 官方文档更新 RSS"),
    ("Amazon DynamoDB 动态", "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/dynamodbupdates.rss", "AWS", "Amazon DynamoDB", "键值数据库", "AWS,Amazon DynamoDB,键值数据库", "AWS Amazon DynamoDB 官方文档更新 RSS"),
    ("Amazon ElastiCache (Valkey/Redis OSS) 动态", "https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/amazon-elcr-release-notes.rss", "AWS", "Amazon ElastiCache (Valkey/Redis OSS)", "缓存", "AWS,Amazon ElastiCache,Valkey,Redis,缓存", "AWS Amazon ElastiCache for Valkey / Redis OSS 官方文档更新 RSS"),
    ("Amazon DocumentDB 动态", "https://aws.amazon.com/blogs/database/category/database/amazon-document-db/feed/", "AWS", "Amazon DocumentDB", "文档数据库", "AWS,Amazon DocumentDB,文档数据库", "AWS Amazon DocumentDB 数据库博客 RSS"),
    ("Amazon Neptune 动态", "https://docs.aws.amazon.com/neptune/latest/userguide/rssupdates.rss", "AWS", "Amazon Neptune", "图数据库", "AWS,Amazon Neptune,图数据库", "AWS Amazon Neptune 官方文档更新 RSS"),
    ("Amazon Keyspaces for Apache Cassandra 动态", "https://aws.amazon.com/blogs/database/category/database/amazon-managed-apache-cassandra-service/feed/", "AWS", "Amazon Keyspaces for Apache Cassandra", "宽列数据库", "AWS,Amazon Keyspaces for Apache Cassandra,宽列数据库", "AWS Amazon Keyspaces for Apache Cassandra 数据库博客 RSS"),
    ("Amazon Timestream 动态", "https://aws.amazon.com/blogs/database/category/database/amazon-timestream/feed/", "AWS", "Amazon Timestream", "时序数据库", "AWS,Amazon Timestream,时序数据库", "AWS Amazon Timestream 数据库博客 RSS"),
    ("Amazon RDS 动态", "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rdsupdates.rss", "AWS", "Amazon RDS", "关系型", "AWS,Amazon RDS,关系型", "AWS Amazon RDS 官方文档更新 RSS"),
]

GOOGLE_CLOUD_DATABASE_FEEDS = [
    ("Cloud SQL 动态", "https://docs.cloud.google.com/feeds/cloud-sql-release-notes.xml", "Google Cloud", "Cloud SQL", "关系型", "Google Cloud,Cloud SQL,MySQL,PostgreSQL,SQL Server,关系型", "Google Cloud SQL release notes RSS，覆盖 MySQL、PostgreSQL 和 SQL Server"),
    ("AlloyDB for PostgreSQL 动态", "https://docs.cloud.google.com/feeds/alloydb-release-notes.xml", "Google Cloud", "AlloyDB for PostgreSQL", "关系型", "Google Cloud,AlloyDB,PostgreSQL,AlloyDB AI,关系型", "Google Cloud AlloyDB for PostgreSQL release notes RSS，覆盖 AlloyDB AI 相关更新"),
    ("AlloyDB Omni 动态", "https://docs.cloud.google.com/feeds/alloydbomni-release-notes.xml", "Google Cloud", "AlloyDB Omni", "关系型", "Google Cloud,AlloyDB Omni,PostgreSQL,关系型", "Google Cloud AlloyDB Omni release notes RSS"),
    ("Spanner 动态", "https://docs.cloud.google.com/feeds/spanner-release-notes.xml", "Google Cloud", "Spanner", "关系型", "Google Cloud,Spanner,Spanner Graph,vector search,关系型", "Google Cloud Spanner release notes RSS，覆盖 Spanner Graph 和 Spanner vector search"),
    ("Bigtable 动态", "https://docs.cloud.google.com/feeds/bigtable-release-notes.xml", "Google Cloud", "Bigtable", "宽列数据库", "Google Cloud,Bigtable,vector search,宽列数据库", "Google Cloud Bigtable release notes RSS，覆盖 Bigtable vector search"),
    ("Firestore 动态", "https://docs.cloud.google.com/feeds/fs-release-notes.xml", "Google Cloud", "Firestore / Firestore with MongoDB compatibility", "文档数据库", "Google Cloud,Firestore,MongoDB compatibility,文档数据库", "Google Cloud Firestore release notes RSS，覆盖 MongoDB compatibility"),
    ("Datastore 动态", "https://docs.cloud.google.com/feeds/datastore-release-notes.xml", "Google Cloud", "Firestore in Datastore mode / Datastore", "文档数据库", "Google Cloud,Firestore in Datastore mode,Datastore,文档数据库", "Google Cloud Datastore release notes RSS，覆盖 Firestore in Datastore mode"),
    ("Memorystore for Redis 动态", "https://docs.cloud.google.com/feeds/memorystore-release-notes.xml", "Google Cloud", "Memorystore for Redis", "缓存", "Google Cloud,Memorystore,Redis,缓存", "Google Cloud Memorystore for Redis release notes RSS"),
]

VOLCENGINE_SOURCE_META = {
    "Redis": ("Redis", "Redis"),
    "Valkey": ("Valkey", "Valkey"),
    "MySQL Community 8.4": ("MySQL", "MySQL Community 8.4"),
    "MySQL Community 8.0": ("MySQL", "MySQL Community 8.0"),
    "TiDB": ("PingCAP", "TiDB"),
    "OceanBase Docs": ("OceanBase", "OceanBase"),
    "OceanBase GitHub": ("OceanBase", "OceanBase"),
    "PolarDB-X": ("PolarDB-X", "PolarDB-X"),
    "PostgreSQL": ("PostgreSQL", "PostgreSQL"),
    "MongoDB": ("MongoDB", "MongoDB"),
    "Apache HBase": ("Apache", "Apache HBase"),
    "Apache Phoenix": ("Apache", "Apache Phoenix"),
    "SQL Server": ("Microsoft", "SQL Server"),
    "Elasticsearch": ("Elastic", "Elasticsearch"),
    "OpenSearch": ("OpenSearch", "OpenSearch"),
    "Milvus": ("Milvus", "Milvus"),
    "Qdrant": ("Qdrant", "Qdrant"),
    "Weaviate": ("Weaviate", "Weaviate"),
    "Chroma": ("Chroma", "Chroma"),
    "FAISS": ("Meta", "FAISS"),
    "HNSWlib": ("nmslib", "HNSWlib"),
    "DiskANN": ("Microsoft", "DiskANN"),
    "pgvector": ("pgvector", "pgvector"),
    "Mem0": ("Mem0", "Mem0"),
    "Zep": ("Zep", "Zep"),
    "Letta / MemGPT": ("Letta", "Letta / MemGPT"),
    "LangGraph memory": ("LangChain", "LangGraph memory"),
    "TencentDB Agent Memory": ("腾讯云", "TencentDB Agent Memory"),
    "OpenViking": ("OpenViking", "OpenViking"),
    "Supabase GitHub": ("Supabase", "Supabase"),
    "Supabase Changelog": ("Supabase", "Supabase"),
}


def unique_nonempty(values: list[str]) -> list[str]:
    result = []
    for value in values:
        value = (value or "").strip()
        if value and value not in result:
            result.append(value)
    return result


def strip_dynamic_suffix(value: str) -> str:
    value = (value or "").strip()
    if value.endswith(" 动态"):
        return value[:-3].strip()
    if value.endswith("动态"):
        return value[:-2].strip()
    return value


def actual_volcengine_source_name(feed: dict[str, Any]) -> str:
    name = strip_dynamic_suffix(feed.get("name") or "")
    product = (feed.get("product") or "").strip()
    prefix = f"火山引擎 {product} / "
    if product and name.startswith(prefix):
        return name[len(prefix):].strip()
    if name.startswith("火山引擎 "):
        parts = [part.strip() for part in name.removeprefix("火山引擎 ").split(" / ") if part.strip()]
        if parts:
            return parts[-1]
    return name


def table_columns(conn, table: str) -> set[str]:
    return {row["name"] for row in rows(conn.execute(f"PRAGMA table_info({table})"))}


def migrate(conn):
    feed_count = one(conn.execute("SELECT COUNT(*) AS c FROM feeds"))["c"]
    if "website_url" in table_columns(conn, "feeds"):
        conn.execute("ALTER TABLE feeds DROP COLUMN website_url")
    feed_columns = table_columns(conn, "feeds")
    if "etag" not in feed_columns:
        conn.execute("ALTER TABLE feeds ADD COLUMN etag TEXT DEFAULT ''")
    if "last_modified" not in feed_columns:
        conn.execute("ALTER TABLE feeds ADD COLUMN last_modified TEXT DEFAULT ''")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries(published_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries(feed_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_entries_feed_published_at ON entries(feed_id, published_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_group_feeds_group_feed ON group_feeds(group_id, feed_id)")
    conn.execute(
        """UPDATE feeds
           SET name = ?, product = ?, db_type = ?, tags = ?, description = ?
           WHERE rss_url = ?""",
        ("腾讯云向量数据库动态", "向量数据库", "向量数据库", "腾讯云,向量数据库", "腾讯云向量数据库产品更新 RSS", TENCENT_VECTOR_RSS_URL),
    )
    vector_feed = one(conn.execute("SELECT id FROM feeds WHERE rss_url = ?", (TENCENT_VECTOR_RSS_URL,)))
    vector_group = one(conn.execute("SELECT id FROM groups WHERE name = ?", ("向量数据库动态",)))
    if vector_feed:
        conn.execute("DELETE FROM entries WHERE feed_id = ? AND guid LIKE 'seed-%'", (vector_feed["id"],))
        conn.execute(
            "DELETE FROM group_feeds WHERE feed_id = ? AND group_id IN (SELECT id FROM groups WHERE name = ?)",
            (vector_feed["id"], "云厂商关系型数据库"),
        )
    if vector_feed and vector_group:
        conn.execute(
            """INSERT OR IGNORE INTO group_feeds(group_id, feed_id, sort_order)
               VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM group_feeds WHERE group_id = ?), 0))""",
            (vector_group["id"], vector_feed["id"], vector_group["id"]),
        )
    if feed_count:
        ensure_aws_database_feeds(conn)
        ensure_google_cloud_database_feeds(conn)
    normalize_volcengine_feed_metadata(conn)


def ensure_aws_database_feeds(conn):
    updated_at = now_iso()
    for name, rss_url, vendor, product, db_type, tags, description in AWS_DATABASE_FEEDS:
        existing = one(conn.execute("SELECT id FROM feeds WHERE rss_url = ?", (rss_url,)))
        if existing:
            conn.execute(
                """UPDATE feeds
                   SET name = ?, vendor = ?, product = ?, db_type = ?, tags = ?, description = ?, updated_at = ?
                   WHERE id = ?""",
                (name, vendor, product, db_type, tags, description, updated_at, existing["id"]),
            )
        else:
            conn.execute(
                """INSERT INTO feeds(name, rss_url, vendor, product, db_type, tags, description, enabled, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'normal')""",
                (name, rss_url, vendor, product, db_type, tags, description),
            )


def ensure_google_cloud_database_feeds(conn):
    updated_at = now_iso()
    for name, rss_url, vendor, product, db_type, tags, description in GOOGLE_CLOUD_DATABASE_FEEDS:
        existing = one(conn.execute("SELECT id FROM feeds WHERE rss_url = ?", (rss_url,)))
        if existing:
            conn.execute(
                """UPDATE feeds
                   SET name = ?, vendor = ?, product = ?, db_type = ?, tags = ?, description = ?, updated_at = ?
                   WHERE id = ?""",
                (name, vendor, product, db_type, tags, description, updated_at, existing["id"]),
            )
        else:
            conn.execute(
                """INSERT INTO feeds(name, rss_url, vendor, product, db_type, tags, description, enabled, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'normal')""",
                (name, rss_url, vendor, product, db_type, tags, description),
            )


def normalize_volcengine_feed_metadata(conn):
    candidates = rows(
        conn.execute(
            """SELECT id, name, vendor, product, db_type, tags, description
               FROM feeds
               WHERE vendor = ? OR name LIKE ? OR tags LIKE ?""",
            ("火山引擎", "火山引擎 %", "%火山引擎%"),
        )
    )
    updated_at = now_iso()
    for feed in candidates:
        source = actual_volcengine_source_name(feed)
        if not source:
            continue
        vendor, product = VOLCENGINE_SOURCE_META.get(source, (source, source))
        db_type = feed.get("db_type") or ""
        tags = ",".join(unique_nonempty([vendor, product, source, db_type]))
        values = {
            "name": f"{source} 动态",
            "vendor": vendor,
            "product": product,
            "tags": tags,
            "description": f"{source} 更新订阅",
        }
        if all((feed.get(key) or "") == value for key, value in values.items()):
            continue
        conn.execute(
            """UPDATE feeds
               SET name = ?, vendor = ?, product = ?, tags = ?, description = ?, updated_at = ?
               WHERE id = ?""",
            (values["name"], values["vendor"], values["product"], values["tags"], values["description"], updated_at, feed["id"]),
        )


def seed(conn):
    count = one(conn.execute("SELECT COUNT(*) AS c FROM feeds"))["c"]
    if count:
        return
    feeds = [
        ("腾讯云向量数据库动态", TENCENT_VECTOR_RSS_URL, "腾讯云", "向量数据库", "向量数据库", "腾讯云,向量数据库", "腾讯云向量数据库产品更新 RSS"),
        ("阿里云 RDS 动态", "https://rsshub.app/aliyun/news", "阿里云", "RDS", "关系型", "云厂商,关系型", "阿里云数据库更新动态"),
        ("PostgreSQL 官方动态", "https://www.postgresql.org/about/newsarchive/rss/", "PostgreSQL", "PostgreSQL", "关系型", "PostgreSQL,开源", "PostgreSQL 官方新闻"),
        ("Redis 官方更新", "https://redis.io/blog/feed/", "Redis", "Redis", "缓存", "Redis,缓存", "Redis 官方博客"),
        ("MongoDB 官方动态", "https://www.mongodb.com/company/blog/rss", "MongoDB", "MongoDB", "文档数据库", "MongoDB,文档", "MongoDB 官方博客"),
        *AWS_DATABASE_FEEDS,
        *GOOGLE_CLOUD_DATABASE_FEEDS,
    ]
    for f in feeds:
        conn.execute("INSERT INTO feeds(name, rss_url, vendor, product, db_type, tags, description) VALUES (?, ?, ?, ?, ?, ?, ?)", f)
    groups = [
        ("云厂商关系型数据库", "聚合 AWS、Google Cloud、阿里云等云厂商关系型数据库动态", "云厂商,关系型", "aggregate", 1, [2, 6, 14, 15, 16, 17, 18, 19, 20, 21]),
        ("缓存数据库动态", "Redis 与云缓存数据库更新", "Redis,缓存", "aggregate", 1, [4, 8, 9, 25]),
        ("PostgreSQL 生态", "PostgreSQL 官方及云厂商兼容产品更新", "PostgreSQL,关系型", "aggregate", 1, [3, 6, 18, 19, 20]),
        ("向量数据库动态", "向量数据库产品公告和云厂商更新", "向量数据库,AI", "calendar", 1, [1]),
        ("文档数据库动态", "MongoDB 及文档数据库生态动态", "MongoDB,文档", "aggregate", 1, [5, 10, 23, 24]),
    ]
    for name, desc, tags, view, enabled, feed_ids in groups:
        cur = conn.execute("INSERT INTO groups(name, description, tags, default_view, enabled) VALUES (?, ?, ?, ?, ?)", (name, desc, tags, view, enabled))
        gid = cur.lastrowid
        for idx, fid in enumerate(feed_ids):
            conn.execute("INSERT INTO group_feeds(group_id, feed_id, sort_order) VALUES (?, ?, ?)", (gid, fid, idx))
    base = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0)
    samples = ["PostgreSQL 17.4 Released", "Aurora PostgreSQL 版本更新", "Cloud SQL for PostgreSQL 新增功能", "Redis 8 发布候选版本", "MongoDB Atlas Search 更新", "腾讯云向量数据库能力升级", "AWS RDS 性能洞察更新"]
    for i, title in enumerate(samples * 4):
        feed_id = (i % len(feeds)) + 1
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
        where.append("e.published_at >= ?"); params.append(filters["start"])
    if filters.get("end"):
        where.append("e.published_at < ?"); params.append(next_day(filters["end"]))
    sql_where = " WHERE " + " AND ".join(where) if where else ""
    sql = f"""SELECT e.*, f.name AS feed_name, f.vendor, f.product, f.db_type
              FROM entries e JOIN feeds f ON f.id=e.feed_id {sql_where}
              ORDER BY e.published_at DESC, e.id DESC LIMIT ? OFFSET ?"""
    count_sql = f"SELECT COUNT(*) AS c FROM entries e JOIN feeds f ON f.id=e.feed_id {sql_where}"
    with db() as conn:
        total = one(conn.execute(count_sql, params))["c"]
        data = rows(conn.execute(sql, params + [limit, offset]))
    return {"total": total, "items": data}


def calendar(filters, month: str = ""):
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


def forwarded_value(value: str | None) -> str:
    return (value or "").split(",", 1)[0].strip()


def public_base_url(request: Request) -> str:
    configured_url = os.getenv("PRODUCTHUNTER_PUBLIC_BASE_URL") or os.getenv("RSSHUNTER_PUBLIC_BASE_URL")
    if configured_url:
        return configured_url.rstrip("/")
    host = forwarded_value(request.headers.get("x-forwarded-host")) or forwarded_value(request.headers.get("host"))
    if host:
        proto = forwarded_value(request.headers.get("x-forwarded-proto")) or request.url.scheme
        port = forwarded_value(request.headers.get("x-forwarded-port"))
        if port and ":" not in host and not ((proto == "http" and port == "80") or (proto == "https" and port == "443")):
            host = f"{host}:{port}"
        return f"{proto}://{host}".rstrip("/")
    return str(request.base_url).rstrip("/")


def read_skill_file(path: Path) -> str:
    if not path.exists():
        raise HTTPException(404, "Skill 安装文件不存在")
    return path.read_text(encoding="utf-8")


@app.get("/api/skill/SKILL.md", response_class=PlainTextResponse)
def skill_install_guide(request: Request):
    text = read_skill_file(SKILL_PUBLIC_DIR / "SKILL.md")
    return PlainTextResponse(text.replace("{{BASE_URL}}", public_base_url(request)))


@app.get("/api/skill/install.sh", response_class=PlainTextResponse)
def skill_install_script(request: Request):
    text = read_skill_file(SKILL_PUBLIC_DIR / "install.sh")
    return PlainTextResponse(text.replace("{{BASE_URL}}", public_base_url(request)), media_type="text/x-shellscript")


@app.get("/api/skill/package/{file_path:path}", response_class=PlainTextResponse)
def skill_package_file(file_path: str, request: Request):
    if file_path not in SKILL_PACKAGE_FILES:
        raise HTTPException(404, "Skill 文件不存在")
    text = read_skill_file(SKILL_PACKAGE_DIR / file_path)
    return PlainTextResponse(text.replace("{{BASE_URL}}", public_base_url(request)))


@app.get("/api/overview")
def overview():
    today = datetime.now(timezone.utc).date().isoformat()
    start = (datetime.now(timezone.utc).date() - timedelta(days=6)).isoformat()
    with db() as conn:
        stats = {
            "today_entries": one(conn.execute("SELECT COUNT(*) c FROM entries WHERE date(published_at)=date(?)", (today,)))["c"],
            "feed_count": one(conn.execute("SELECT COUNT(*) c FROM feeds"))["c"],
            "group_count": one(conn.execute("SELECT COUNT(*) c FROM groups"))["c"],
            "abnormal_count": one(conn.execute("SELECT COUNT(*) c FROM feeds WHERE status IN ('fetch_failed','parse_error') OR enabled=0"))["c"],
        }
        trend = rows(conn.execute("SELECT date(published_at) date, COUNT(*) count FROM entries WHERE date(published_at)>=date(?) GROUP BY date(published_at)", (start,)))
        recent_feeds = rows(conn.execute("SELECT *, (SELECT COUNT(*) FROM entries WHERE feed_id=feeds.id AND date(published_at)=date(?)) today_new FROM feeds ORDER BY datetime(latest_item_published_at) DESC LIMIT 5", (today,)))
        groups = rows(conn.execute("SELECT g.*, COUNT(gf.feed_id) feed_count, COALESCE(MAX(e.published_at),'') latest_update FROM groups g LEFT JOIN group_feeds gf ON gf.group_id=g.id LEFT JOIN entries e ON e.feed_id=gf.feed_id GROUP BY g.id ORDER BY g.id LIMIT 5"))
        abnormal = rows(conn.execute("SELECT * FROM feeds WHERE status IN ('fetch_failed','parse_error') OR enabled=0 ORDER BY updated_at DESC LIMIT 8"))
    return {"stats": stats, "trend": trend, "recent_feeds": recent_feeds, "groups": groups, "abnormal_feeds": abnormal}


@app.get("/api/feeds")
def list_feeds(keyword: str = "", vendor: str = "", product: str = "", db_type: str = "", status: str = ""):
    where, params = [], []
    if keyword:
        where.append("(f.name LIKE ? OR f.rss_url LIKE ? OR f.vendor LIKE ? OR f.product LIKE ?)"); params += [f"%{keyword}%"] * 4
    for val, col in [(vendor, "f.vendor"), (product, "f.product"), (db_type, "f.db_type"), (status, "f.status")]:
        if val:
            where.append(f"{col} = ?"); params.append(val)
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


@app.get("/api/feeds/{feed_id}/entries")
def feed_entries(feed_id: int, keyword: str = "", limit: int = 50, offset: int = 0):
    return query_entries({"feed_id": feed_id, "keyword": keyword}, limit, offset)


@app.get("/api/feeds/{feed_id}/calendar")
def feed_calendar(feed_id: int, month: str = ""):
    return calendar({"feed_id": feed_id}, month)


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
