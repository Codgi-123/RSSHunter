const vendorStyles = {
  腾讯云: ['腾', 'vendor-tencent'],
  阿里云: ['阿', 'vendor-aliyun'],
  AWS: ['AWS', 'vendor-aws'],
  PostgreSQL: ['PG', 'vendor-postgres'],
  Redis: ['R', 'vendor-redis'],
  MongoDB: ['M', 'vendor-mongo'],
};

export default function VendorBadge({ vendor = '' }) {
  const [abbr, tone] = vendorStyles[vendor] || [vendor.slice(0, 2).toUpperCase() || '-', 'vendor-default'];
  return <span className={`vendor-badge ${tone}`}><i>{abbr}</i>{vendor || '-'}</span>;
}
