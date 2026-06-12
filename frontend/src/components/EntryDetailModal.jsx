import { formatDateTime } from '../utils/format';
import Modal from './Modal';

export default function EntryDetailModal({ entry, onClose }) {
  if (!entry) return null;

  return (
    <Modal title="动态详情" onClose={onClose} footer={<button className="primary-button" onClick={onClose}>关闭</button>}>
      <dl className="entry-detail">
        <dt>标题</dt>
        <dd>{entry.title}</dd>
        <dt>来源</dt>
        <dd>{entry.feed_name} / {entry.vendor} / {entry.product}</dd>
        <dt>发布时间</dt>
        <dd>{formatDateTime(entry.published_at)}</dd>
        <dt>摘要</dt>
        <dd>{entry.summary || '-'}</dd>
        <dt>原文链接</dt>
        <dd>{entry.link ? <a href={entry.link} target="_blank" rel="noreferrer">{entry.link}</a> : '-'}</dd>
      </dl>
    </Modal>
  );
}
