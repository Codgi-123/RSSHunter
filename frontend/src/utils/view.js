export function viewLabel(value) {
  return ({ aggregate: '聚合列表', source: '按源分组', calendar: '日历视图' })[value] || value || '-';
}
