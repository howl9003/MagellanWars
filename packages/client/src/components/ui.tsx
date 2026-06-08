// Shared UI primitives for the retro-terminal design system
import { type ReactNode } from 'react';
import type { Toast, ToastVariant } from '../hooks/useToast.js';

// ─── Skeleton loaders ────────────────────────────────────────────────────────

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card skel-block skeleton" style={{ height: 'auto', padding: 16 }}>
      <div className="skel-line skel-header skeleton" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel-line skeleton" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <table className="data-table">
      <thead>
        <tr>{Array.from({ length: cols }).map((_, i) => <th key={i}><div className="skel-line skeleton" style={{ width: 60 }} /></th>)}</tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}><div className="skel-line skeleton" style={{ width: `${50 + ((r + c) % 4) * 12}%` }} /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Page header ─────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="text-muted text-sm" style={{ margin: 0 }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex-center gap-8">{actions}</div>}
    </div>
  );
}

// ─── Stat block ──────────────────────────────────────────────────────────────

export function Stat({ label, value, unit, color }: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="stat-block">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : undefined}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

export function ProgressBar({ value, max, label, variant, showPct = false }: {
  value: number;
  max: number;
  label?: string;
  variant?: 'green' | 'amber' | 'red' | 'purple';
  showPct?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      {(label || showPct) && (
        <div className="flex-between mb-4 text-xs text-muted">
          {label && <span>{label}</span>}
          {showPct && <span>{pct}%</span>}
        </div>
      )}
      <div className={`progress ${variant ? `progress--${variant}` : ''}`}>
        <div className="progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function Badge({ children, variant = 'muted' }: {
  children: ReactNode;
  variant?: 'accent' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'muted';
}) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, variant, glow, sm, className = '' }: {
  children: ReactNode;
  variant?: 'green' | 'amber' | 'red' | 'purple' | 'teal';
  glow?: boolean;
  sm?: boolean;
  className?: string;
}) {
  const classes = [
    'card',
    variant ? `card--${variant}` : '',
    glow ? 'card--glow' : '',
    sm ? 'card--sm' : '',
    className,
  ].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}

// ─── Section title ────────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="section-title">{children}</div>;
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

export function TabBar<T extends string>({ tabs, active, onChange }: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && (
            <span className="badge badge--muted" style={{ marginLeft: 6 }}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Data table ──────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  right?: boolean;
  width?: number | string;
  render?: (row: T) => ReactNode;
}

export function DataTable<T extends Record<string, unknown>>({ columns, rows, emptyMsg = 'No data.' }: {
  columns: Column<T>[];
  rows: T[];
  emptyMsg?: string;
}) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} className={c.right ? 'num' : ''} style={c.width ? { width: c.width } : undefined}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>{emptyMsg}</td></tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={c.right ? 'num' : ''}>
                  {c.render ? c.render(row) : String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────────

export function Alert({ children, variant = 'info', onDismiss }: {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  onDismiss?: () => void;
}) {
  return (
    <div className={`alert alert--${variant}`}>
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss && (
        <button className="btn btn--sm" style={{ padding: '0 6px', border: 'none' }} onClick={onDismiss}>✕</button>
      )}
    </div>
  );
}

// ─── Toast container ──────────────────────────────────────────────────────────

const VARIANT_CLASS: Record<ToastVariant, string> = {
  info: '',
  success: 'toast--success',
  warning: 'toast--warning',
  error: 'toast--error',
};

export function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${VARIANT_CLASS[t.variant]}`}>
          <span>{t.message}</span>
          <button className="btn btn--sm" style={{ padding: '0 6px', border: 'none', opacity: 0.6 }} onClick={() => dismiss(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function Empty({ message = 'Nothing here.', action }: { message?: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>◌</div>
      <p className="text-sm" style={{ margin: '0 0 12px' }}>{message}</p>
      {action}
    </div>
  );
}

// ─── Keyboard shortcut hint ───────────────────────────────────────────────────

export function KbHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex-center gap-4 text-xs text-muted">
      <kbd className="kbkey">{k}</kbd>{label}
    </span>
  );
}
