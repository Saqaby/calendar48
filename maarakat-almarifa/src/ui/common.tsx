import { ReactNode, useEffect, useRef, useState } from 'react';
import saqeelLogo from '../assets/saqeel-logo-horizontal.png';

/* ---------------- الشعارات الخيالية ---------------- */

export const EMBLEMS: { id: string; label: string; node: ReactNode }[] = [
  { id: 'star', label: 'نجمة', node: <path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.3l7.1-.7z" /> },
  { id: 'bolt', label: 'برق', node: <path d="M13.5 2L4 14h7l-1.5 8L20 10h-7z" /> },
  { id: 'crown', label: 'تاج', node: <path d="M3 17L4.5 6.5l4.5 4.5L12 4l3 7 4.5-4.5L21 17zM3 18.5h18V21H3z" /> },
  { id: 'tower', label: 'قلعة', node: <path d="M4 21V9h2V5h2.5v4h2V5h3v4h2V5H18v4h2v12h-6v-5a2 2 0 0 0-4 0v5z" /> },
  { id: 'mountain', label: 'جبل', node: <path d="M1.5 20.5L9 7l4 7 2.6-4 6.9 10.5z" /> },
  { id: 'flame', label: 'شعلة', node: <path d="M12 2c1.2 4 6.5 6.2 6.5 12.2A6.5 6.5 0 0 1 5.5 14.2c0-3 1.8-5 3.2-6.3.1 2.3 1 3.6 2.3 3.9-.3-3.4-.4-6.6 1-9.8z" /> },
  {
    id: 'compass', label: 'بوصلة',
    node: <><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 4.5l2.6 7.5L12 19.5 9.4 12z" /></>,
  },
  {
    id: 'anchor', label: 'مرساة',
    node: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="4.8" r="2.3" /><path d="M12 7v14M7.5 10.5h9M4 13.5a8 7.5 0 0 0 16 0" /></g>,
  },
  {
    id: 'chevrons', label: 'رتبة',
    node: <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round"><path d="M4 9l8-5 8 5M4 14.5l8-5 8 5M4 20l8-5 8 5" /></g>,
  },
  {
    id: 'atom', label: 'ذرّة',
    node: <g fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="12" rx="10" ry="4" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /></g>,
  },
  {
    id: 'book', label: 'كتاب',
    node: <><path d="M2.5 5c3.2-1.2 6.5-1 9.5 1.2C15 4 18.3 3.8 21.5 5v14.5c-3.2-1.2-6.5-1-9.5 1.2-3-2.2-6.3-2.4-9.5-1.2z" /><path d="M12 7v13" stroke="rgba(5,10,20,.85)" strokeWidth="1.5" /></>,
  },
  { id: 'shield', label: 'درع', node: <path d="M12 3l7 3v5.5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5V6zm0 4l-1.2 2.6-2.8.3 2.1 1.9-.6 2.8 2.5-1.5 2.5 1.5-.6-2.8 2.1-1.9-2.8-.3z" fillRule="evenodd" /> },
];

export const TEAM_COLORS = [
  { value: '#2f6bff', label: 'أزرق' },
  { value: '#ff7a1a', label: 'برتقالي' },
  { value: '#8a4dff', label: 'بنفسجي' },
  { value: '#00a99d', label: 'فيروزي' },
  { value: '#f5b800', label: 'أصفر' },
  { value: '#e8418c', label: 'وردي' },
  { value: '#5bb318', label: 'أخضر' },
  { value: '#6b7a99', label: 'رمادي' },
];

export function Emblem({ id, color, size = 64, className = '' }: { id: string; color: string; size?: number; className?: string }) {
  const e = EMBLEMS.find((x) => x.id === id) ?? EMBLEMS[0];
  const gid = `sh-${id}-${color.replace('#', '')}`;
  return (
    <svg className={`emblem ${className}`} width={size} height={size} viewBox="0 0 48 52" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path d="M24 2l20 6.5v14c0 13.5-8.6 23.3-20 27.5C12.6 45.8 4 36 4 22.5v-14z" fill={`url(#${gid})`} stroke="#14213d" strokeWidth="3" />
      <path d="M24 6.5l16 5.2v11c0 11-6.9 19-16 22.6C14.9 41.7 8 33.7 8 22.7v-11z" fill="#14213d" />
      <g transform="translate(12 12.5)" fill="currentColor" color="#fff">{e.node}</g>
    </svg>
  );
}

/* ---------------- أيقونات الأدوات ---------------- */

const ICONS: Record<string, ReactNode> = {
  soundOn: <path d="M4 9v6h4l5 4V5L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />,
  soundOff: <path d="M4 9v6h4l5 4V5L8 9zm12.6 3L19 9.6 17.6 8.2 15.2 10.6 12.8 8.2l-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z" transform="translate(2 0)" />,
  fullscreen: <path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z" />,
  undo: <path d="M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6A7.5 7.5 0 0 1 19.5 16l2.4-.8A10 10 0 0 0 12.5 8z" />,
  pause: <path d="M6 5h4v14H6zm8 0h4v14h-4z" />,
  play: <path d="M17 5v14L6 12z" />,
  home: <path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z" />,
  projector: <path d="M3 5h18v11H3zm2 2v7h14V7zM8 18h8v2H8z" />,
  check: <path d="M9.5 16.2L5.3 12l-1.4 1.4 5.6 5.6L21 7.5l-1.4-1.4z" />,
  cross: <path d="M18.3 5.7L16.9 4.3 12 9.2 7.1 4.3 5.7 5.7 10.6 10.6 5.7 15.5l1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9z" transform="translate(0 1.4)" />,
  clock: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6V6h-2v7.4l5.2 3.1 1-1.7z" />,
  flag: <path d="M5 3h2v18H5zm3 1h11l-2.5 4L19 12H8z" />,
  swap: <path d="M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7zm10 10H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11z" />,
  eye: <path d="M12 5C6.5 5 2.7 9.3 1.5 12c1.2 2.7 5 7 10.5 7s9.3-4.3 10.5-7C21.3 9.3 17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
  plus: <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" />,
  up: <path d="M12 6l7 7-1.4 1.4L12 8.8l-5.6 5.6L5 13z" />,
  down: <path d="M12 18l-7-7 1.4-1.4 5.6 5.6 5.6-5.6L19 11z" />,
  trash: <path d="M8 4V2h8v2h5v2H3V4zm-3 4h14l-1 14H6zm4 3v8h2v-8zm4 0v8h2v-8z" />,
  edit: <path d="M3 17.2V21h3.8l11-11-3.8-3.8zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8z" />,
  shuffle: <path d="M14.8 4H20v5.2l-2-2-4.1 4.1-1.4-1.4L16.6 5.8zM4 18.6L18 4.6l1.4 1.4-14 14zM20 14.8V20h-5.2l2-2-3.4-3.4 1.4-1.4 3.4 3.4z" />,
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/* ---------------- النوافذ ---------------- */

export function Modal({
  title, children, actions, onClose, tone = 'default', wide = false,
}: {
  title: string; children: ReactNode; actions?: ReactNode; onClose?: () => void;
  tone?: 'default' | 'danger' | 'gold'; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={`modal tone-${tone} ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          {onClose && <button className="icon-btn ghost" onClick={onClose} aria-label="إغلاق"><Icon name="cross" /></button>}
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export interface ConfirmRequest {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
}

export function ConfirmDialog({ req, onClose }: { req: ConfirmRequest; onClose: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <Modal title={req.title} onClose={onClose} tone={req.tone === 'danger' ? 'danger' : 'default'}
      actions={<>
        <button className="btn ghost" onClick={onClose}>إلغاء</button>
        <button className={`btn ${req.tone === 'danger' ? 'danger' : 'primary'}`} disabled={done}
          onClick={() => { setDone(true); req.onConfirm(); onClose(); }}>{req.confirmLabel}</button>
      </>}>
      <div className="confirm-msg">{req.message}</div>
    </Modal>
  );
}

/* ---------------- مساعدات ---------------- */

export function useNow(active: boolean, interval = 200): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [active, interval]);
  return active ? now : Date.now();
}

export function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="delta zero">بلا تغيير</span>;
  return <span className={`delta ${value > 0 ? 'up' : 'down'}`}>{value > 0 ? '+' : '−'}{Math.abs(value).toLocaleString('ar-EG')}</span>;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toLocaleString('ar-EG')}:${s.toLocaleString('ar-EG', { minimumIntegerDigits: 2 })}`;
}

/* ---------------- تذييل الجهة المنفّذة ---------------- */

/** يمكن إخفاؤه في بناء خاص بضبط VITE_HIDE_CREDIT=1 */
export const SHOW_CREDIT = import.meta.env.VITE_HIDE_CREDIT !== '1';

export function Credit() {
  if (!SHOW_CREDIT) return null;
  return (
    <footer className="credit">
      <span className="credit-text">من إعداد وتنفيذ</span>
      <img className="credit-logo" src={saqeelLogo} alt="جمعية صقيل لتنمية الشباب" width={176} height={60} />
    </footer>
  );
}
