'use client';

import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number; // ms, default 4000
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: (id: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = 'info', duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev, { id, message, variant, duration }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SuccessIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function ErrorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CONFIG: Record<ToastVariant, { bg: string; border: string; icon: React.ReactNode; progress: string }> = {
  success: {
    bg: 'rgba(16, 38, 80, 0.97)',
    border: '1px solid rgba(34, 197, 94, 0.5)',
    icon: <SuccessIcon />,
    progress: '#22c55e',
  },
  error: {
    bg: 'rgba(30, 10, 10, 0.97)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    icon: <ErrorIcon />,
    progress: '#ef4444',
  },
  warning: {
    bg: 'rgba(30, 24, 5, 0.97)',
    border: '1px solid rgba(234, 179, 8, 0.5)',
    icon: <WarningIcon />,
    progress: '#eab308',
  },
  info: {
    bg: 'rgba(16, 38, 80, 0.97)',
    border: '1px solid rgba(99, 179, 237, 0.4)',
    icon: <InfoIcon />,
    progress: '#63b3ed',
  },
};

const ICON_COLOR: Record<ToastVariant, string> = {
  success: '#22c55e',
  error: '#ef4444',
  warning: '#eab308',
  info: '#63b3ed',
};

// ── Single Toast Item ─────────────────────────────────────────────────────────

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
  const cfg = CONFIG[t.variant];
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el || !t.duration) return;
    el.style.transition = `width ${t.duration}ms linear`;
    requestAnimationFrame(() => { el.style.width = '0%'; });
  }, [t.duration]);

  return (
    <div
      role="alert"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        background: cfg.bg,
        border: cfg.border,
        borderRadius: '10px',
        padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(12px)',
        minWidth: '280px',
        maxWidth: '420px',
        animation: 'idexo-toast-in 0.25s ease',
        overflow: 'hidden',
        cursor: 'default',
        fontFamily: 'inherit',
      }}
      onClick={() => onDismiss(t.id)}
    >
      {/* Icon */}
      <span style={{ color: ICON_COLOR[t.variant], flexShrink: 0, marginTop: '1px' }}>
        {cfg.icon}
      </span>

      {/* Message */}
      <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.45', color: '#e2e8f0', flexGrow: 1, wordBreak: 'break-word' }}>
        {t.message}
      </p>

      {/* Dismiss × */}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(t.id); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#718096', padding: '0 0 0 4px', lineHeight: 1,
          fontSize: '16px', flexShrink: 0, marginTop: '-1px',
        }}
        aria-label="Dismiss notification"
      >
        ×
      </button>

      {/* Progress bar */}
      {t.duration && t.duration > 0 && (
        <div
          ref={barRef}
          style={{
            position: 'absolute',
            bottom: 0, left: 0,
            height: '3px',
            width: '100%',
            background: cfg.progress,
            borderRadius: '0 0 0 10px',
            opacity: 0.7,
          }}
        />
      )}
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes idexo-toast-in {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem t={t} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>
  );
}
