# RSSHunter

数据库动态 RSS 管理平台，使用 FastAPI + SQLite + React + Tailwind CSS 实现，支持 RSS 订阅源、订阅组、动态条目、日历视图、源状态与结构化 API 查询。

## 快速启动

```bash
docker compose up --build
```

- 前端：http://localhost:4000
- 后端 API：http://localhost:9000
- API 文档：http://localhost:9000/docs

## 本地开发

### 后端

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 9000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

## 数据持久化

SQLite 数据库默认位于 `backend/data/rsshunter.db`，Docker Compose 会挂载到 `rsshunter_data` volume。
