import { Database } from 'lucide-react';
import { vendorLogos } from '../data/vendorLogos';

export default function VendorBadge({ vendor = '' }) {
  const logo = vendorLogos[vendor];

  return (
    <span className={`vendor-badge ${logo ? 'has-logo' : 'is-fallback'}`} title={vendor || '-'}>
      <span className="vendor-logo" aria-hidden="true">
        {logo ? <img src={logo.src} alt="" /> : <Database size={16} />}
      </span>
      <span className="vendor-name">{vendor || '-'}</span>
    </span>
  );
}
