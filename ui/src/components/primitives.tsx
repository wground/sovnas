import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IconX } from '../icons';

export function Modal({ title, onClose, children, wide, footer }: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className={`flex max-h-[calc(100vh-2rem)] w-full flex-col ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl bg-white shadow-2xl dark:bg-neutral-900 dark:text-neutral-100`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-medium">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close">
            <IconX />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-6 pb-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-neutral-100 px-6 py-3 dark:border-neutral-800">{footer}</div>}
      </div>
    </div>
  );
}

export function Btn({ kind = 'plain', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'plain' | 'danger' | 'ghost' }) {
  const k = {
    primary: 'bg-brand text-white hover:bg-brand-dark disabled:opacity-50',
    plain: 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
  }[kind];
  return <button {...p} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${k} ${className}`} />;
}

export function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin text-neutral-400`} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PromptDialog({ title, label, initial = '', confirm = 'OK', onSubmit, onClose, selectStem }: {
  title: string;
  label?: string;
  initial?: string;
  confirm?: string;
  onSubmit: (v: string) => void;
  onClose: () => void;
  selectStem?: boolean;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const dot = initial.lastIndexOf('.');
    if (selectStem && dot > 0) el.setSelectionRange(0, dot);
    else el.select();
  }, [initial, selectStem]);
  const ok = v.trim() && !v.includes('/') && v.trim() !== '.' && v.trim() !== '..';
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn kind="primary" disabled={!ok} onClick={() => ok && onSubmit(v.trim())}>{confirm}</Btn>
      </>}
    >
      {label && <label className="mb-1 block text-sm text-neutral-500">{label}</label>}
      <input
        ref={ref}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && ok && onSubmit(v.trim())}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-neutral-700 dark:bg-neutral-800"
      />
    </Modal>
  );
}

export function ConfirmDialog({ title, body, confirm = 'Delete', danger = true, onConfirm, onClose }: {
  title: string;
  body: React.ReactNode;
  confirm?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn kind={danger ? 'danger' : 'primary'} onClick={onConfirm} autoFocus>{confirm}</Btn>
      </>}
    >
      <div className="text-sm text-neutral-600 dark:text-neutral-300">{body}</div>
    </Modal>
  );
}

// ------------------------------------------------------------------ toast ---

type Toast = { id: number; msg: string; ok: boolean };
const ToastCtx = createContext<(msg: string, ok?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, ok = true) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg, ok }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ok ? 3500 : 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm shadow-lg ${t.ok ? 'bg-neutral-800 text-white' : 'bg-red-600 text-white'}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// --------------------------------------------------------------- menus ---

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({
        x: Math.min(x, window.innerWidth - r.width - 8),
        y: Math.min(y, window.innerHeight - r.height - 8),
      });
    }
    const close = () => onClose();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', k);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', k);
      window.removeEventListener('blur', close);
    };
  }, [x, y, onClose]);
  return (
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 min-w-[200px] rounded-xl border border-neutral-200 bg-white py-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-800"
      onMouseDown={(e) => e.stopPropagation()}
      role="menu"
    >
      {items.filter((i) => !i.hidden).map((i) => (
        <button
          key={i.label}
          role="menuitem"
          onClick={() => { onClose(); i.onClick(); }}
          className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 ${i.danger ? 'text-red-600' : 'text-neutral-700 dark:text-neutral-200'}`}
        >
          <span className="text-neutral-500">{i.icon}</span>
          {i.label}
        </button>
      ))}
    </div>
  );
}
