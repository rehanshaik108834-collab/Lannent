import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { _subscribe } from '../lib/validation';

/* Validate.toast / Validate.confirm, with the original markup and styles. */

const TOAST_COLORS = {
  success: { bg: '#10b981', icon: '✓' },
  error: { bg: '#ef4444', icon: '✕' },
  warning: { bg: '#f59e0b', icon: '!' },
  info: { bg: '#6366f1', icon: 'ℹ' },
};

function ensureToastKeyframes() {
  if (document.getElementById('toast-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'toast-keyframes';
  style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(16px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}';
  document.head.appendChild(style);
}

export function ToastHost() {
  const [toast, setToast] = useState(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => _subscribe('toast', (t) => { ensureToastKeyframes(); setLeaving(false); setToast(t); }), []);

  useEffect(() => {
    if (!toast) return undefined;
    let removeTimer;
    const hideTimer = setTimeout(() => {
      setLeaving(true);
      removeTimer = setTimeout(() => setToast((cur) => (cur && cur.id === toast.id ? null : cur)), 300);
    }, toast.duration);
    return () => { clearTimeout(hideTimer); clearTimeout(removeTimer); };
  }, [toast]);

  if (!toast) return null;
  const c = TOAST_COLORS[toast.type] || TOAST_COLORS.success;
  return createPortal(
    <div
      id="lannent-toast"
      key={toast.id}
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 99999,
        display: 'flex', alignItems: 'center', gap: 12,
        background: c.bg, color: '#fff',
        padding: '14px 20px', borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
        animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        maxWidth: 380,
        ...(leaving ? { opacity: 0, transform: 'translateY(8px)', transition: 'all 0.3s' } : {}),
      }}
    >
      <span style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.25)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{c.icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
    </div>,
    document.body,
  );
}

export function ConfirmHost() {
  const [dialog, setDialog] = useState(null);
  useEffect(() => _subscribe('confirm', setDialog), []);
  if (!dialog) return null;

  const close = (confirmed) => {
    setDialog(null);
    if (confirmed) dialog.onConfirm?.();
    else dialog.onCancel?.();
  };

  return createPortal(
    <div
      id="lannent-confirm"
      key={dialog.id}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
    >
      <div style={{ background: 'var(--card,#fff)', borderRadius: 20, padding: 28, maxWidth: 400, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ width: 48, height: 48, background: '#fff7ed', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <svg width="24" height="24" fill="none" stroke="#f97316" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Confirm Action</p>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground,#64748b)', marginBottom: 24, lineHeight: 1.5 }}>{dialog.message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button id="confirmCancel" onClick={() => close(false)} style={{ flex: 1, padding: 10, borderRadius: 12, border: '1px solid var(--border,#e2e8f0)', background: 'var(--background,#fff)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button id="confirmOk" onClick={() => close(true)} style={{ flex: 1, padding: 10, borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Confirm</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
