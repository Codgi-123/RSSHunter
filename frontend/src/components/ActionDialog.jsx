import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const menuWidth = 224;

function getPosition(button) {
  const rect = button.getBoundingClientRect();
  return {
    left: Math.min(window.innerWidth - menuWidth - 12, Math.max(12, rect.right - menuWidth)),
    top: rect.bottom + 8,
  };
}

export default function ActionDialog({ title = '更多操作', actions = [] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [runningLabel, setRunningLabel] = useState('');
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function updatePosition() {
      if (!buttonRef.current) return;
      setPosition(getPosition(buttonRef.current));
    }

    function closeOnOutside(event) {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    updatePosition();
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !position || !menuRef.current || !buttonRef.current) return;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const next = { ...position };
    if (menuRect.bottom > window.innerHeight - 12) next.top = Math.max(12, buttonRect.top - menuRect.height - 8);
    if (menuRect.right > window.innerWidth - 12) next.left = Math.max(12, window.innerWidth - menuRect.width - 12);
    if (next.top !== position.top || next.left !== position.left) setPosition(next);
  }, [open, position]);

  async function run(action) {
    if (action.disabled || runningLabel) return;
    setRunningLabel(action.label);
    try {
      await action.onClick?.();
      setOpen(false);
    } finally {
      setRunningLabel('');
    }
  }

  const menu = open && position && createPortal(
    <div className="action-popover" ref={menuRef} style={{ left: position.left, top: position.top }}>
      <div className="action-popover-title">{title}</div>
      <div className="action-dialog-list">
        {actions.map((action) => (
          <button key={action.label} type="button" className={`action-dialog-item ${action.danger ? 'danger' : ''} ${action.primary ? 'primary' : ''}`} onClick={() => run(action)} disabled={action.disabled || Boolean(runningLabel)}>
            {action.icon}
            <span>{runningLabel === action.label ? '处理中...' : action.label}</span>
            {action.description && <small>{action.description}</small>}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      <button ref={buttonRef} className="action-more-button" type="button" onClick={() => setOpen((value) => !value)} title="更多操作" aria-label="更多操作" aria-haspopup="menu" aria-expanded={open}><MoreHorizontal size={18} /></button>
      {menu}
    </>
  );
}
