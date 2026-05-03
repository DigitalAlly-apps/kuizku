// Reusable UI Components for Ujianly
import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/AppContext';
import type { ToastMessage } from '../../types';

// ============================================================
// Toast System
// ============================================================
function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: () => void }) {
  const icons = { success: CheckCircle, error: AlertCircle, warning: AlertTriangle, info: Info };
  const Icon = icons[toast.type];
  const colors = { success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--primary)' };
  return (
    <div className={`toast toast-${toast.type}`}>
      <Icon size={18} style={{ color: colors[toast.type], flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <div className="toast-title">{toast.title}</div>
        {toast.message && <div className="toast-msg">{toast.message}</div>}
      </div>
      <button onClick={onRemove} className="btn-icon btn btn-ghost" style={{ padding: 2, opacity: 0.6 }}>
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />)}
    </div>
  );
}

// ============================================================
// Modal
// ============================================================
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'default' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'default' }: ModalProps) {
  if (!open) return null;
  const sizeClass = size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : '';
  return (
    <div className="modal-overlay animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box ${sizeClass} animate-slide-up`}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ============================================================
// Confirm Dialog
// ============================================================
interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Konfirmasi', cancelLabel = 'Batal', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }>
      <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
    </Modal>
  );
}

// ============================================================
// Badge
// ============================================================
type BadgeVariant = 'pg' | 'essay' | 'combo' | 'draft' | 'active' | 'ended' | 'archived' | 'success' | 'warning' | 'danger';

export function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function FormatBadge({ format }: { format: import('../../types').ExamFormat }) {
  if (format === 'PG_ONLY') return <Badge variant="pg">PG</Badge>;
  if (format === 'ESSAY_ONLY') return <Badge variant="essay">Essay</Badge>;
  return <Badge variant="combo">PG + Essay</Badge>;
}

export function StatusBadge({ status }: { status: import('../../types').ExamStatus }) {
  const labels = { DRAFT: 'Draft', ACTIVE: 'Aktif', ENDED: 'Selesai', ARCHIVED: 'Diarsipkan' };
  const variants: Record<string, BadgeVariant> = { DRAFT: 'draft', ACTIVE: 'active', ENDED: 'ended', ARCHIVED: 'archived' };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

export function ExamTypeBadge({ examType }: { examType?: import('../../types').ExamType }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    UJIAN:   { label: '📝 Ujian',   color: 'var(--danger)',  bg: 'var(--danger-light)' },
    TUGAS:   { label: '📋 Tugas',   color: 'var(--warning)', bg: 'var(--warning-light)' },
    LATIHAN: { label: '🎯 Latihan', color: 'var(--success)', bg: 'var(--success-light)' },
  };
  const c = config[examType ?? 'UJIAN'] ?? config['UJIAN'];
  return (
    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--r-sm)', background: c.bg, color: c.color, fontWeight: 700 }}>
      {c.label}
    </span>
  );
}


// ============================================================
// Spinner / Loading
// ============================================================
export function Spinner({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return <span className={`spinner${size === 'lg' ? ' spinner-lg' : ''}`} />;
}

export function PageLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }} className="animate-fade-in">
      <Spinner size="lg" />
      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>Memuat data...</span>
    </div>
  );
}

// ============================================================
// Skeleton Loader
// ============================================================
export function Skeleton({ width, height, className = '' }: { width?: string | number, height?: string | number, className?: string }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width || '100%',
        height: height || '20px',
        background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-loading 1.5s infinite linear',
        borderRadius: 'var(--r-md)',
      }}
    />
  );
}

// ============================================================
// Empty State
// ============================================================
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state animate-scale-in">
      <div className="empty-icon" style={{
        background: 'var(--surface-2)',
        width: 80, height: 80, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8, boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)'
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '1.2rem', marginTop: 8 }}>{title}</h3>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.6 }}>{description}</p>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

// ============================================================
// Toggle Switch
// ============================================================
interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}

export function Toggle({ label, hint, checked, onChange, id }: ToggleProps) {
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-label">{label}</div>
        {hint && <div className="toggle-hint">{hint}</div>}
      </div>
      <label className="switch" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="switch-track" />
      </label>
    </div>
  );
}

// ============================================================
// Tag Input
// ============================================================
interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ tags, onChange, placeholder = 'Tambah tag, tekan Enter...' }: TagInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && inputRef.current) {
      e.preventDefault();
      const val = inputRef.current.value.trim();
      if (val && !tags.includes(val)) onChange([...tags, val]);
      inputRef.current.value = '';
    }
    if (e.key === 'Backspace' && inputRef.current?.value === '' && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  const remove = (tag: string) => onChange(tags.filter(t => t !== tag));

  return (
    <div className="form-input" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 42, cursor: 'text', height: 'auto', padding: '6px 10px' }}
      onClick={() => inputRef.current?.focus()}>
      {tags.map(tag => (
        <span key={tag} className="tag">
          {tag}
          <button type="button" onClick={(e) => { e.stopPropagation(); remove(tag); }}><X size={10} /></button>
        </span>
      ))}
      <input ref={inputRef} onKeyDown={handleKeyDown} placeholder={tags.length === 0 ? placeholder : ''}
        style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '0.875rem', minWidth: 120, flex: 1 }} />
    </div>
  );
}

// ============================================================
// Stat Card
// ============================================================
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

export function StatCard({ label, value, icon, color, bg }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: bg, color }}>
        {icon}
      </div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}

// ============================================================
// Section Header
// ============================================================
export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="section-header">
      <div>
        <h2 style={{ fontSize: '1.1rem', marginBottom: subtitle ? 2 : 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {action && <div className="section-header-action">{action}</div>}
    </div>
  );
}

export function NetworkStatusBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, zIndex: 60,
      padding: '8px 12px', borderRadius: 'var(--r-md)',
      background: online ? 'rgba(16,185,129,0.92)' : 'rgba(239,68,68,0.92)',
      color: 'white', fontSize: '0.78rem', fontWeight: 600,
      boxShadow: 'var(--shadow-lg)',
    }}>
      {online ? 'Online: sinkronisasi aktif' : 'Offline: submit akan diantrikan'}
    </div>
  );
}
