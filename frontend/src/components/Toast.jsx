import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const noop = () => {};
noop.success = noop;
noop.error = noop;
noop.info = noop;
const ToastContext = createContext(noop);

let seq = 0;
const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback((message, type = 'info') => {
    if (!message) return;
    const id = ++seq;
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  const toast = useMemo(() => {
    const fn = (message, type) => push(message, type);
    fn.success = (message) => push(message, 'success');
    fn.error = (message) => push(message, 'error');
    fn.info = (message) => push(message, 'info');
    return fn;
  }, [push]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="通知">
        {toasts.map(({ id, message, type }) => {
          const Icon = ICONS[type] || Info;
          return (
            <div key={id} className={`toast toast-${type}`} role="status">
              <Icon size={16} className="toast-icon" />
              <span className="toast-message">{message}</span>
              <button type="button" className="toast-close" onClick={() => remove(id)} aria-label="关闭通知"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
