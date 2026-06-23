import { Database, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import CalendarGrid from '../components/CalendarGrid';
import DayEntriesPanel from '../components/DayEntriesPanel';
import EntryDetailModal from '../components/EntryDetailModal';
import EntryTimeline from '../components/EntryTimeline';
import LoadingState from '../components/LoadingState';
import { useToast } from '../components/Toast';
import { useFeeds, useGroup, useGroupCalendar, useGroupEntries, useInvalidateAll } from '../queries';
import { monoAbbr, splitTags, unique } from '../utils/format';
import { GroupModal } from './GroupsPage';

export default function GroupDetailPage() {
  const navigate = useNavigate();
  const invalidate = useInvalidateAll();
  const toast = useToast();
  const { groupId: groupIdParam } = useParams();
  const groupId = Number(groupIdParam);

  const [tab, setTab] = useState('stream');           // 'stream' | 'calendar' | 'members'

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dayItems, setDayItems] = useState(null);
  const [monthKey, setMonthKey] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(undefined);
  const [editForm, setEditForm] = useState({});
  const [editBusy, setEditBusy] = useState(false);
  const [editErrors, setEditErrors] = useState({});

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const calendarOn = tab === 'calendar';

  const { data: group, isLoading, error: groupError, refetch } = useGroup(groupId);
  const { data: entries = { total: 0, items: [] } } = useGroupEntries(groupId, { limit: pageSize, offset: (page - 1) * pageSize }, tab === 'stream');
  const { data: calendar = [] } = useGroupCalendar(groupId, { month }, calendarOn);
  const { data: calendarMonths = [] } = useGroupCalendar(groupId, { month: month.slice(0, 4) }, calendarOn);
  const { data: monthCal = [] } = useGroupCalendar(groupId, { month: monthKey || '' }, calendarOn && !!monthKey);
  const { data: todayData } = useGroupEntries(groupId, { start: today, end: today, limit: 1 });
  const { data: weekData } = useGroupEntries(groupId, { start: weekAgo, end: today, limit: 1 });
  const { data: feeds = [] } = useFeeds();

  const todayCount = todayData?.total ?? null;
  const weekCount = weekData?.total ?? null;
  const badCount = group?.bad_feed_count ?? 0;

  const vendors = useMemo(() => unique(group?.feeds || [], 'vendor'), [group]);

  // Calendar：与订阅管理/全局动态一致，使用统一的 CalendarGrid + 右侧抽屉
  const monthDrawer = monthKey ? { date: `${monthKey} 全月`, items: monthCal.flatMap((d) => d.items || []) } : null;
  const calDrawer = dayItems || monthDrawer;
  const closeCalDrawer = () => { setDayItems(null); setMonthKey(null); };

  function openEdit() {
    if (!group) return;
    setEditErrors({});
    setEditForm({ ...group, tags: splitTags(group.tags), feed_ids: (group.feeds || []).map((f) => f.id) });
    setEditing(group);
  }

  async function submitEdit() {
    const errors = {};
    if (!editForm.name?.trim()) errors.name = '请输入订阅组名称';
    if (!editForm.feed_ids?.length) errors.feed_ids = '请至少选择一个订阅源';
    setEditErrors(errors);
    if (Object.keys(errors).length) return;
    const payload = { ...editForm, tags: splitTags(editForm.tags), enabled: Boolean(editForm.enabled), feed_ids: editForm.feed_ids.map(Number) };
    setEditBusy(true);
    try {
      await api.put(`/groups/${groupId}`, payload);
      setEditing(undefined);
      await invalidate();
      toast.success('订阅组已更新');
    } catch (err) {
      setEditErrors({ name: err.message });
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteGroup() {
    if (!group) return;
    if (!confirm(`确认删除订阅组「${group.name}」？`)) return;
    setEditBusy(true);
    try {
      await api.delete(`/groups/${groupId}`);
      await invalidate();
      toast.success('订阅组已删除');
      navigate('/groups');
    } catch (err) {
      toast.error(err.message);
      setEditBusy(false);
    }
  }

  if (isLoading) return <LoadingState title="正在加载订阅组…" rows={4} />;
  if (!group) {
    return (
      <div className="state-panel">
        <p>无法加载订阅组</p>
        <button onClick={() => refetch()}>重试</button>
      </div>
    );
  }

  const feedCount = group.feeds?.length ?? 0;

  return (
    <>
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link to="/groups">订阅组管理</Link>
        <span>/</span>
        <span style={{ color: 'var(--ink-2)' }}>{group.name}</span>
      </nav>

      {/* Group Header */}
      <div className="group-header">
        <div className="group-header-left">
          <div className="group-icon-box">
            <Database size={24} />
          </div>
          <div>
            <div className="group-title">{group.name}</div>
            {group.description && <div className="group-desc">{group.description}</div>}
          </div>
        </div>
        <div className="group-header-actions">
          <button className="underline-btn" onClick={openEdit} disabled={editBusy}>
            <Plus size={14} />
            添加订阅源
          </button>
          <button className="underline-btn" onClick={openEdit} disabled={editBusy}>
            编辑
          </button>
          <button className="underline-btn underline-btn-danger" onClick={deleteGroup} disabled={editBusy}>
            <Trash2 size={14} />
            删除
          </button>
        </div>
      </div>

      {/* Stat Strip */}
      <div className="stat-strip">
        <div className="stat-strip-item">
          <div className="stat-label">订阅源</div>
          <div className="stat-value">{feedCount}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-label">今日动态</div>
          <div className="stat-value stat-value-accent">{todayCount ?? '–'}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-label">近 7 天</div>
          <div className="stat-value">{weekCount ?? '–'}</div>
        </div>
        <div className="stat-strip-item">
          <div className="stat-label">异常源</div>
          <div className={`stat-value ${badCount > 0 ? 'stat-value-warm' : ''}`}>{badCount}</div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'stream' ? 'active' : ''}`} onClick={() => { closeCalDrawer(); setTab('stream'); }}>
          聚合动态流
        </button>
        <button className={`tab-btn ${tab === 'calendar' ? 'active' : ''}`} onClick={() => { closeCalDrawer(); setTab('calendar'); }}>
          日历视图
        </button>
        <button className={`tab-btn ${tab === 'members' ? 'active' : ''}`} onClick={() => { closeCalDrawer(); setTab('members'); }}>
          组内订阅源 · {feedCount}
        </button>
      </div>

      {/* Tab: 聚合动态流 */}
      {tab === 'stream' && (
        <div className="timeline-list">
          <EntryTimeline entries={entries.items} timeFormat="time" onDetail={setDetail} />
          <div className="pagination-bar" style={{ borderTop: '1px solid var(--line)', marginTop: 0 }}>
            <span className="result-count">共 {entries.total} 条</span>
            <div className="pagination-controls">
              <button
                className="page-button icon-page"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >‹</button>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{page} / {Math.max(1, Math.ceil(entries.total / pageSize))}</span>
              <button
                className="page-button icon-page"
                disabled={page >= Math.ceil(entries.total / pageSize)}
                onClick={() => setPage(page + 1)}
              >›</button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: 日历视图 */}
      {tab === 'calendar' && (
        <div className={`calendar-layout ${calDrawer ? 'has-drawer' : ''}`}>
          <CalendarGrid
            days={calendar}
            monthlyDays={calendarMonths}
            month={month}
            onMonthChange={(value) => { closeCalDrawer(); setMonth(value); }}
            onDayClick={(d) => { setMonthKey(null); setDayItems(d); }}
            onMonthClick={(m) => { setDayItems(null); setMonthKey(m); }}
          />
          {calDrawer && <DayEntriesPanel dayItems={calDrawer} onClose={closeCalDrawer} onDetail={setDetail} />}
        </div>
      )}

      {/* Tab: 组内订阅源 */}
      {tab === 'members' && (
        <div className="member-list">
          {(group.feeds || []).map((feed) => {
            const abbr = monoAbbr(feed.vendor || feed.name);
            const isOk = feed.status !== 'fetch_failed' && feed.status !== 'parse_error';
            return (
              <div
                key={feed.id}
                className="member-item"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/feeds/${feed.id}`)}
              >
                <span className="member-mono">{abbr}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="member-name">{feed.name}</div>
                  <div className="member-vendor">{feed.vendor}</div>
                </div>
                <span className={`status-dot ${isOk ? 'status-dot-ok' : 'status-dot-bad'}`} />
                <span className="member-today">–</span>
              </div>
            );
          })}
          {!(group.feeds || []).length && (
            <div className="state-panel">暂无订阅源</div>
          )}
        </div>
      )}

      {/* Entry Detail Modal */}
      <EntryDetailModal entry={detail} onClose={() => setDetail(null)} />

      {/* Edit Group Modal */}
      {editing !== undefined && (
        <GroupModal
          form={editForm}
          setForm={setEditForm}
          feeds={feeds}
          title="编辑订阅组"
          busy={editBusy}
          errors={editErrors}
          onClose={() => setEditing(undefined)}
          onSubmit={submitEdit}
        />
      )}

    </>
  );
}
