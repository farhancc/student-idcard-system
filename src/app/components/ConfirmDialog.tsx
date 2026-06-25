'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Trap focus on confirm button when opened
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const accentColor = variant === 'danger' ? 'var(--danger)' : 'var(--warning)';
  const accentGlow  = variant === 'danger' ? 'var(--danger-glow)' : 'var(--warning-glow)';
  const iconBg      = variant === 'danger' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(3, 4, 7, 0.75)',
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(13,16,27,0.95)',
          border: `1px solid rgba(255,255,255,0.09)`,
          borderTop: `2px solid ${accentColor}`,
          borderRadius: '16px',
          padding: '28px 32px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`,
          animation: 'slideUp 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          position: 'relative',
        }}
      >
        {/* Close ×  */}
        <button
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          border: `1px solid ${accentColor}30`,
        }}>
          <AlertTriangle size={22} color={accentColor} />
        </div>

        {/* Title */}
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '8px', color: '#f8fafc' }}>
          {title}
        </h3>

        {/* Message */}
        <p style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '24px' }}>
          {message}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ padding: '8px 18px', fontSize: '0.875rem' }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            className={variant === 'danger' ? 'btn btn-danger' : 'btn'}
            style={{
              padding: '8px 18px',
              fontSize: '0.875rem',
              ...(variant === 'warning' ? {
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                color: '#fff',
                boxShadow: `0 4px 14px 0 ${accentGlow}`,
              } : {}),
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}
