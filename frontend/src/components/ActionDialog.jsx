import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

// Radix DropdownMenu handles positioning, collision flipping, outside-click,
// Escape and keyboard navigation. We keep the menu open while an async action
// runs, then close it on success.
export default function ActionDialog({ title = '更多操作', actions = [] }) {
  const [open, setOpen] = useState(false);
  const [runningLabel, setRunningLabel] = useState('');

  async function run(action, event) {
    event.preventDefault();
    if (action.disabled || runningLabel) return;
    setRunningLabel(action.label);
    try {
      await action.onClick?.();
      setOpen(false);
    } finally {
      setRunningLabel('');
    }
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button className="action-more-button" type="button" title="更多操作" aria-label="更多操作"><MoreHorizontal size={18} /></button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="action-popover" align="end" sideOffset={8} collisionPadding={10} aria-label={title}>
          <div className="action-popover-title">{title}</div>
          <div className="action-dialog-list">
            {actions.map((action) => (
              <DropdownMenu.Item
                key={action.label}
                className={`action-dialog-item ${action.danger ? 'danger' : ''} ${action.primary ? 'primary' : ''}`}
                disabled={action.disabled || Boolean(runningLabel)}
                onSelect={(event) => run(action, event)}
              >
                {action.icon}
                <span>{runningLabel === action.label ? '处理中...' : action.label}</span>
                {action.description && <small>{action.description}</small>}
              </DropdownMenu.Item>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
