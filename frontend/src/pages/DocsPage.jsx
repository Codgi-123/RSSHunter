import { BookOpen, Code2 } from 'lucide-react';
import { PageTitle } from '../components/Layout';

const sections = [
  ['订阅源 API', ['GET /api/feeds', 'POST /api/feeds', 'GET /api/feeds/{id}', 'PUT /api/feeds/{id}', 'DELETE /api/feeds/{id}', 'POST /api/feeds/{id}/refresh', 'GET /api/feeds/{id}/entries', 'GET /api/feeds/{id}/calendar']],
  ['订阅组 API', ['GET /api/groups', 'POST /api/groups', 'GET /api/groups/{id}', 'PUT /api/groups/{id}', 'DELETE /api/groups/{id}', 'GET /api/groups/{id}/entries', 'GET /api/groups/{id}/entries-by-source', 'GET /api/groups/{id}/calendar']],
  ['条目与状态 API', ['GET /api/entries', 'GET /api/entries/{id}', 'GET /api/calendar', 'GET /api/overview', 'GET /api/fetch-logs']],
];

export default function DocsPage() {
  return (
    <>
      <PageTitle title="API 文档" subtitle="为 OpenClaw / Codex / 其他 Agent Skill 提供结构化查询能力" />
      <section className="docs-hero"><BookOpen size={42} /><div><h2>RSSHunter API</h2><p>所有接口返回 JSON，可按关键词、厂商、产品、数据库类型、订阅源和订阅组进行查询。</p></div></section>
      <section className="api-section-grid">{sections.map(([title, endpoints]) => <article className="panel api-section" key={title}><h3>{title}</h3>{endpoints.map((endpoint) => <code key={endpoint}><Code2 size={15} />{endpoint}</code>)}</article>)}</section>
      <section className="panel"><h2>Agent 调用示例</h2><pre>{`curl 'http://localhost:9000/api/entries?keyword=PostgreSQL&vendor=AWS'
curl 'http://localhost:9000/api/groups/1/entries-by-source'
curl 'http://localhost:9000/api/calendar?db_type=向量数据库'`}</pre></section>
    </>
  );
}
