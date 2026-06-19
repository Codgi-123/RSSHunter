import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

// Radix Dialog handles focus trap, scroll lock, Escape and outside-click for us.
export default function Modal({ title, children, onClose, footer }) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop">
          <Dialog.Content className="modal-card" aria-describedby={undefined}>
            <header className="modal-header">
              <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
              <Dialog.Close asChild><button className="icon-button" aria-label="关闭"><X size={18} /></button></Dialog.Close>
            </header>
            <div className="modal-body">{children}</div>
            {footer && <footer className="modal-footer">{footer}</footer>}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
