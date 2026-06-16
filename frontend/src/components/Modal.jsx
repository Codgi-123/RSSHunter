import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function Modal({ title, children, onClose, footer }) {
  const cardRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement;

    function closeOnEscape(event) {
      if (event.key === 'Escape') onCloseRef.current?.();
    }

    document.addEventListener('keydown', closeOnEscape);
    cardRef.current?.querySelector('button, input, select, textarea, a[href]')?.focus();
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      previous?.focus?.();
    };
  }, []);

  function trapFocus(event) {
    if (event.key !== 'Tab' || !cardRef.current) return;
    const focusable = Array.from(cardRef.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'))
      .filter((item) => !item.disabled && item.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={cardRef} onKeyDown={trapFocus} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>
  );
}
