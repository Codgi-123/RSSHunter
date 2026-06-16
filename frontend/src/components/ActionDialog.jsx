import { MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [runningLabel, setRunningLabel] = useState('');
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const closeMenu = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function updatePosition() {
      if (!buttonRef.current) return;
      setPosition(getPosition(buttonRef.current));
    }

    function closeOnOutside(event) {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      closeMenu(false);
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') closeMenu();
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
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open || !menuRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector('button:not(:disabled)')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, position]);

  useEffect(() => {
    if (!open || !position || !menuRef.current || !buttonRef.current) return;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const next = { ...position };
    let didFlip = false;
    if (menuRect.bottom > window.innerHeight - 12) { next.top = Math.max(12, buttonRect.top - menuRect.height - 8); didFlip = true; }
    if (menuRect.right > window.innerWidth - 12) next.left = Math.max(12, window.innerWidth - menuRect.width - 12);
    if (next.top !== position.top || next.left !== position.left) setPosition(next);
    setFlipped(didFlip);
  }, [open, position]);

  async function run(action) {
    if (action.disabled || runningLabel) return;
    setRunningLabel(action.label);
    try {
      await action.onClick?.();
      closeMenu();
    } finally {
      setRunningLabel('');
    }
  }

  function handleMenuKeyDown(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !menuRef.current) return;
    const items = Array.from(menuRef.current.querySelectorAll('button:not(:disabled)'));
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = Math.max(0, items.indexOf(document.activeElement));
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  const menu = open && position && createPortal(
    <div className={`action-popover${flipped ? ' flipped' : ''}`} id={menuId} ref={menuRef} style={{ left: position.left, top: position.top }} role="menu" aria-label={title} onKeyDown={handleMenuKeyDown}>
      <div className="action-popover-title">{title}</div>
      <div className="action-dialog-list">
        {actions.map((action) => (
          <button key={action.label} type="button" role="menuitem" className={`action-dialog-item ${action.danger ? 'danger' : ''} ${action.primary ? 'primary' : ''}`} onClick={() => run(action)} disabled={action.disabled || Boolean(runningLabel)}>
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
      <button ref={buttonRef} className="action-more-button" type="button" onClick={() => setOpen((value) => !value)} title="更多操作" aria-label="更多操作" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}><MoreHorizontal size={18} /></button>
      {menu}
    </>
  );
}
