import { BookOpen, Bot, Code2, FileText, Terminal } from 'lucide-react';
import CopyButton from '../components/CopyButton';
import { PageTitle } from '../components/Layout';

const sections = [
  ['订阅源 API', ['GET /api/feeds', 'POST /api/feeds', 'GET /api/feeds/{id}', 'PUT /api/feeds/{id}', 'DELETE /api/feeds/{id}', 'POST /api/feeds/{id}/refresh', 'GET /api/feeds/{id}/entries', 'GET /api/feeds/{id}/calendar']],
  ['订阅组 API', ['GET /api/groups', 'POST /api/groups', 'GET /api/groups/{id}', 'PUT /api/groups/{id}', 'DELETE /api/groups/{id}', 'GET /api/groups/{id}/entries', 'GET /api/groups/{id}/entries-by-source', 'GET /api/groups/{id}/calendar']],
  ['条目与状态 API', ['GET /api/entries', 'GET /api/entries/{id}', 'GET /api/calendar', 'GET /api/overview', 'GET /api/fetch-logs']],
];

export default function DocsPage() {
  const baseUrl = window.location.origin;
  const skillGuideUrl = `${baseUrl}/api/skill/SKILL.md`;
  const skillInstallPrompt = `参考 ${skillGuideUrl}，安装这个 Agent Skill，安装完成后自动进入订阅组或全局动态更新报告配置`;

  return (
    <>
      <PageTitle title="API 文档" subtitle="为上层 Agent、自动化任务和 Agent Skill 提供结构化查询能力" />
      <section className="docs-hero"><div className="big-icon" style={{ background: '#eef5ff', color: '#1351c5', minWidth: '78px' }}><BookOpen size={34} /></div><div><h2>ProductHunter API</h2><p>所有接口返回 JSON，可按关键词、厂商、产品、数据库类型、订阅源和订阅组进行查询。</p></div></section>
      <section className="panel skill-install-panel">
        <div className="skill-install-head">
          <Bot size={34} />
          <div>
            <h2>Agent Skills</h2>
            <p>一行指令安装「更新报告」Skill，并要求安装 Agent 自动进入订阅组或全局动态配置引导。</p>
          </div>
        </div>
        <div className="agent-prompt-row">
          <code>{skillInstallPrompt}</code>
          <CopyButton text={skillInstallPrompt} label="复制指令" />
        </div>
        <div className="skill-install-grid">
          <article>
            <h3><FileText size={16} />安装入口</h3>
            <p>Agent 会读取纯文本安装指引，随后执行其中的安装脚本。</p>
            <div className="agent-prompt-row"><code>{skillGuideUrl}</code><CopyButton text={skillGuideUrl} label="复制" /></div>
          </article>
          <article>
            <h3><Terminal size={16} />安装脚本</h3>
            <p>脚本会把 skill 安装到 Agent 可发现的位置，并输出自动配置动作。</p>
            <div className="agent-prompt-row"><code>curl -fsSL {baseUrl}/api/skill/install.sh | bash</code><CopyButton text={`curl -fsSL ${baseUrl}/api/skill/install.sh | bash`} label="复制" /></div>
          </article>
        </div>
      </section>
      <section className="api-section-grid">{sections.map(([title, endpoints]) => <article className="panel api-section" key={title}><h3>{title}</h3>{endpoints.map((endpoint) => <code key={endpoint}><Code2 size={15} />{endpoint}</code>)}</article>)}</section>
      <section className="panel"><h2>Agent 调用示例</h2><pre>{`curl '${baseUrl}/api/entries?keyword=PostgreSQL&vendor=AWS'
curl '${baseUrl}/api/groups/1/entries-by-source?start=2026-06-01&end=2026-06-15'
curl '${baseUrl}/api/calendar?db_type=向量数据库'`}</pre></section>
    </>
  );
}
