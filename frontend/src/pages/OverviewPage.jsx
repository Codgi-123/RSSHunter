import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import LoadingState from '../components/LoadingState';
import { useToast } from '../components/Toast';
import { useInvalidateAll, useOverview } from '../queries';
import { formatShortDateTime, splitTags } from '../utils/format';

function StatDelta({ text, tone = 'good', dir = 'up' }) {
  if (!text) return <div className="stat-delta"><span className="stat-delta-flat">较昨日持平</span></div>;
  const Arrow = dir === 'down' ? ArrowDown : ArrowUp;
  return (
    <div className="stat-delta">
      <span className={`stat-delta-val ${tone}`}><Arrow size={11} strokeWidth={3} />{text}</span>
      <span className="stat-delta-sub">较昨日</span>
    </div>
  );
}

const ACCENT = 'oklch(0.45 0.14 255)';

// 把 raw 值向上取整到 1/2/5 × 10^n 的「好看」刻度。
function niceStep(value) {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / pow;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * pow;
}

function fmtTick(v) {
  if (v >= 1000) return `${(v / 1000).toString().replace(/\.0$/, '')}k`;
  return String(v);
}

function TrendChart({ data }) {
  const W = 680;
  const H = 230;
  const padL = 38;
  const padR = 18;
  const padT = 30;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const rawMax = Math.max(1, ...data.map((d) => d.count));
  const step = niceStep(rawMax / 4);
  const max = step * 4;
  const baseY = padT + innerH;

  const x = (i) => padL + (data.length < 2 ? innerW / 2 : (innerW * i) / (data.length - 1));
  const y = (c) => padT + innerH - (innerH * c) / max;

  const pts = data.map((d, i) => [x(i), y(d.count)]);
  const linePoints = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPoints = `${x(0).toFixed(1)},${baseY} ${linePoints} ${x(data.length - 1).toFixed(1)},${baseY}`;
  const ticks = [1, 2, 3, 4].map((k) => k * step);
  const gid = 'trendArea';
  const mono = { fontFamily: 'IBM Plex Mono' };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="最近 7 天动态趋势">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.14" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* gridlines + y 轴刻度 */}
      <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="var(--line)" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--line-3)" />
          <text x={padL - 8} y={y(v) + 3} textAnchor="end" style={{ ...mono, fontSize: 10, fill: 'var(--faint-2)' }}>{fmtTick(v)}</text>
        </g>
      ))}

      {/* 面积 + 折线 */}
      <polygon points={areaPoints} fill={`url(#${gid})`} />
      <polyline fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />

      {/* 数据点 + 数值标签 + x 轴日期 */}
      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        return (
          <g key={d.date}>
            {isLast
              ? <circle cx={x(i)} cy={y(d.count)} r="4" fill="#fff" stroke={ACCENT} strokeWidth="2.5" />
              : <circle cx={x(i)} cy={y(d.count)} r="3" fill={ACCENT} />}
            <text x={x(i)} y={y(d.count) - 10} textAnchor="middle" style={{ ...mono, fontSize: 11, fontWeight: 600, fill: 'var(--ink)' }}>{d.count}</text>
            <text x={x(i)} y={H - 8} textAnchor="middle" style={{ ...mono, fontSize: 10, fill: 'var(--faint)' }}>{d.date}</text>
          </g>
        );
      })}
    </svg>
  );
}

function normalizeTrend(rows = []) {
  const map = Object.fromEntries(rows.map((row) => [row.date, row.count]));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - 6 + index);
    const key = day.toISOString().slice(0, 10);
    return { date: key.slice(5), count: map[key] || 0 };
  });
}

const GROUP_SWATCHES = [
  'oklch(0.55 0.12 255)',
  'oklch(0.6 0.14 35)',
  'oklch(0.55 0.12 165)',
  'oklch(0.6 0.1 310)',
  'oklch(0.6 0.12 80)',
];

function anomalyStatus(feed) {
  const status = feed.enabled ? feed.status : 'disabled';
  const map = {
    fetch_failed: ['抓取失败', 'oklch(0.5 0.1 35)'],
    parse_error: ['解析异常', 'oklch(0.5 0.09 70)'],
    disabled: ['已停用', 'var(--faint)'],
  };
  return map[status] || [status || '-', 'var(--faint)'];
}

const today = new Date().toISOString().slice(0, 10);

export default function OverviewPage() {
  const navigate = useNavigate();
  const invalidate = useInvalidateAll();
  const { data: overview = {}, isLoading } = useOverview();
  const toast = useToast();
  const [busyFeedId, setBusyFeedId] = useState(null);

  const trend = normalizeTrend(overview.trend);
  const stats = overview.stats || {};
  const deltas = overview.deltas || {};
  const recentFeeds = overview.recent_feeds || [];
  const abnormalFeeds = overview.abnormal_feeds || [];
  const groups = overview.groups || [];
  const entriesPct = deltas.today_entries_pct;

  async function feedAction(feed, path, verb) {
    setBusyFeedId(feed.id);
    try {
      await api.post(`/feeds/${feed.id}/${path}`, {});
      await invalidate();
      toast.success(`订阅「${feed.name}」已${verb}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyFeedId(null);
    }
  }

  if (isLoading) return <LoadingState title="正在加载平台数据…" rows={4} />;

  return (
    <>
      {/* Page head */}
      <div className="overview-head">
        <div>
          <div className="overview-eyebrow">OVERVIEW / 首页概览</div>
          <div className="overview-title">今日数据库动态</div>
        </div>
        <div className="overview-head-meta">{today} · 数据每 5 分钟刷新</div>
      </div>

      {/* KPIs */}
      <div className="stat-strip editorial">
        <div className="stat-strip-item clickable" onClick={() => navigate('/entries')}>
          <div className="stat-label">今日新增动态</div>
          <div className="stat-value stat-value-accent">{stats.today_entries ?? 0}</div>
          <StatDelta
            text={entriesPct == null ? null : `${Math.abs(entriesPct)}%`}
            tone={entriesPct >= 0 ? 'good' : 'warm'}
            dir={entriesPct >= 0 ? 'up' : 'down'}
          />
        </div>
        <div className="stat-strip-item clickable" onClick={() => navigate('/feeds')}>
          <div className="stat-label">订阅源总数</div>
          <div className="stat-value">{stats.feed_count ?? 0}</div>
          <StatDelta text={deltas.feed_added ? `${deltas.feed_added} 个` : null} />
        </div>
        <div className="stat-strip-item clickable" onClick={() => navigate('/groups')}>
          <div className="stat-label">订阅组总数</div>
          <div className="stat-value">{stats.group_count ?? 0}</div>
          <StatDelta text={deltas.group_added ? `${deltas.group_added} 个` : null} />
        </div>
        <div className="stat-strip-item clickable" onClick={() => navigate('/feeds?status=abnormal')}>
          <div className="stat-label">异常订阅源</div>
          <div className={`stat-value ${(stats.abnormal_count ?? 0) > 0 ? 'stat-value-warm' : ''}`}>{stats.abnormal_count ?? 0}</div>
        </div>
      </div>

      {/* Trend + Recent */}
      <div className="overview-grid">
        <div className="overview-col">
          <div className="ed-head"><span>最近 7 天动态趋势</span></div>
          <div className="trend-chart">
            <TrendChart data={trend} />
          </div>
        </div>

        <div className="overview-col">
          <div className="ed-head">
            <span>最近更新订阅源</span>
            <button className="ed-link" onClick={() => navigate('/feeds')}>ALL →</button>
          </div>
          <div className="recent-list">
            {recentFeeds.map((feed) => (
              <a key={feed.id} className="recent-row" onClick={() => navigate(`/feeds/${feed.id}`)}>
                <div className="recent-row-main">
                  <div className="recent-row-name">{feed.name}</div>
                  <div className="recent-row-tags">
                    {splitTags(feed.tags).slice(0, 2).map((tag) => (
                      <span className="recent-tag" key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <span className="recent-row-num">+{feed.today_new || 0}</span>
              </a>
            ))}
            {!recentFeeds.length && <div className="state-panel">暂无最近更新订阅源</div>}
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="overview-section-head">
        <span>常用订阅组</span>
        <button className="ed-link" onClick={() => navigate('/groups')}>管理订阅组 →</button>
      </div>
      {groups.length ? (
        <div className="group-grid">
          {groups.map((group, index) => (
            <a className="group-grid-item" key={group.id} onClick={() => navigate(`/groups/${group.id}`)}>
              <div className="group-grid-name-line">
                <span className="group-swatch" style={{ background: GROUP_SWATCHES[index % GROUP_SWATCHES.length] }} />
                <span className="group-grid-name">{group.name}</span>
              </div>
              <div className="group-grid-num">{group.feed_count || 0}<span>订阅</span></div>
              <div className="group-grid-today">+{group.today_new || 0} 今日</div>
            </a>
          ))}
        </div>
      ) : (
        <div className="state-panel">暂无订阅组</div>
      )}

      {/* Anomalies */}
      {abnormalFeeds.length > 0 && (
        <>
          <div className="overview-section-head">
            <div className="anomaly-title">
              <span className="status-dot status-dot-bad" />
              <span>异常订阅源</span>
              <span className="anomaly-count">· 需处理 {stats.abnormal_count ?? abnormalFeeds.length} 项</span>
            </div>
            <button className="ed-link" onClick={() => navigate('/feeds?status=abnormal')}>查看全部 →</button>
          </div>
          <div className="anomaly-table">
            <div className="anomaly-head">
              <span>订阅名称</span><span>厂商</span><span>产品</span><span>异常类型</span><span>最近抓取</span><span className="ta-right">操作</span>
            </div>
            {abnormalFeeds.map((feed) => {
              const [label, color] = anomalyStatus(feed);
              return (
                <div className="anomaly-row" key={feed.id}>
                  <span className="anomaly-name">{feed.name}</span>
                  <span className="anomaly-sub">{feed.vendor || '-'}</span>
                  <span className="anomaly-sub">{feed.product || '-'}</span>
                  <span className="anomaly-type" style={{ color }}>{label}</span>
                  <span className="anomaly-time">{formatShortDateTime(feed.last_fetched_at) || '-'}</span>
                  <span className="anomaly-actions">
                    <button className="ed-link" onClick={() => navigate(`/feeds/${feed.id}`)}>查看</button>
                    <span className="anomaly-sep">·</span>
                    {feed.enabled
                      ? <button className="ed-link" disabled={busyFeedId === feed.id} onClick={() => feedAction(feed, 'refresh', '重试')}>重试</button>
                      : <button className="ed-link" disabled={busyFeedId === feed.id} onClick={() => feedAction(feed, 'enable', '启用')}>启用</button>}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
