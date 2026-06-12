import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function Modal({ title, children, onClose, footer }) {
  const cardRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;

    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose?.();
    }

    document.addEventListener('keydown', closeOnEscape);
    cardRef.current?.querySelector('button, input, select, textarea, a[href]')?.focus();
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={cardRef} onMouseDown={(event) => event.stopPropagation()}>
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
