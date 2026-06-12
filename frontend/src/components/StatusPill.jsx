const statusMap = {
  normal: ['正常', 'status-ok'],
  fetch_failed: ['抓取失败', 'status-bad'],
  parse_error: ['解析异常', 'status-warn'],
  disabled: ['已停用', 'status-muted'],
  success: ['成功', 'status-ok'],
  not_modified: ['无更新', 'status-ok'],
  failed: ['失败', 'status-bad'],
};

export default function StatusPill({ status, enabled = true }) {
  const finalStatus = enabled ? status : 'disabled';
  const [label, className] = statusMap[finalStatus] || [finalStatus || '-', 'status-muted'];
  return <span className={`status-pill ${className}`}>{label}</span>;
}
