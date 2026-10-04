'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScrollText, AlertTriangle } from 'lucide-react';

export interface PendingLegalDocument {
  slug: string;
  title: string;
  version: string;
  summary: string;
  effectiveDate: string;
}

/**
 * Blocks the dashboard until the signed-in user has accepted the current
 * version of every document required of a press user.
 *
 * Rendered by the dashboard layout, which already resolves the pending list
 * server-side — so there is no "flash of usable dashboard" before the gate
 * appears, and no client round trip on every page load.
 *
 * Deliberately not dismissible: the whole point of a version bump is that the
 * previous agreement no longer covers what the press is doing. Signing out is
 * always available.
 */
export default function LegalAcceptanceGate({ pending }: { pending: PendingLegalDocument[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pending.length === 0) return null;

  const isFirstTime = pending.length > 2;

  const signOut = async () => {
    try {
      await fetch('/api/press/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };

  const accept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/legal/acceptance', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not record your acceptance');
      // The layout recomputes what is outstanding; on success that is nothing.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your acceptance');
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-gate-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(4, 8, 20, 0.88)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="glass-panel"
        style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              flexShrink: 0,
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              color: '#818cf8',
            }}
          >
            <ScrollText size={22} />
          </div>
          <div>
            <h3 id="legal-gate-title" style={{ marginBottom: '6px' }}>
              {isFirstTime ? 'Please review our terms' : 'We have updated our terms'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              {isFirstTime
                ? 'Before you carry on, please read and accept the documents that govern your use of IDexo.'
                : 'The documents below have changed since you last accepted them. Please read them and accept the new versions to continue.'}
            </p>
          </div>
        </div>

        <ul style={{ listStyle: 'none', display: 'grid', gap: '10px', marginBottom: '20px' }}>
          {pending.map(doc => (
            <li
              key={doc.slug}
              style={{
                padding: '14px 16px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--glass-border)',
                borderRadius: '10px',
              }}
            >
              <a
                href={`/legal/${doc.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: '0.9rem' }}
              >
                {doc.title} <span style={{ color: 'var(--info)' }}>&#8599;</span>
              </a>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.55 }}>
                {doc.summary}
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Version {doc.version}</span>
            </li>
          ))}
        </ul>

        {error && (
          <div
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              padding: '12px 14px',
              marginBottom: '16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1, minWidth: '200px', padding: '12px' }}
            onClick={accept}
            disabled={submitting}
          >
            {submitting ? 'Recording…' : 'I have read and accept these'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '12px 20px' }}
            onClick={signOut}
            disabled={submitting}
          >
            Sign out
          </button>
        </div>

        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '14px', lineHeight: 1.6 }}>
          We record which version you accept, when, and the IP address it came from, so that both sides can
          rely on it later.
        </p>
      </div>
    </div>
  );
}
