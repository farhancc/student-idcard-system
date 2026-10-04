'use client';

import React from 'react';

/**
 * The consent row used by every flow that has to capture agreement: press
 * signup, client-organisation signup, portal enrolment and marketplace
 * listing.
 *
 * Deliberately presentational. Each flow writes its own sentence as children,
 * because the thing being agreed to differs and a generic "I agree to the
 * terms" is worth less, legally and ethically, than a sentence that says what
 * is actually being agreed to.
 */

export function LegalLink({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <a
      href={`/legal/${slug}`}
      // Opens alongside the form: nobody should lose a half-filled enrolment
      // form to read the notice they are being asked to agree to.
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--info)', textDecoration: 'underline' }}
    >
      {children}
    </a>
  );
}

interface LegalConsentProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  /** Shown when the form was submitted without the box ticked. */
  error?: string | null;
  disabled?: boolean;
}

export function LegalConsent({ id, checked, onChange, children, error, disabled }: LegalConsentProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        padding: '14px 16px',
        background: error ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${error ? 'rgba(239, 68, 68, 0.45)' : 'var(--glass-border)'}`,
        borderRadius: '10px',
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          width: '18px',
          height: '18px',
          marginTop: '2px',
          flexShrink: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          accentColor: '#6366f1',
        }}
      />
      <label
        htmlFor={id}
        style={{
          fontSize: '0.85rem',
          lineHeight: 1.6,
          color: 'var(--muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {children}
        {error && (
          <span id={`${id}-error`} style={{ display: 'block', marginTop: '6px', color: '#f87171' }}>
            {error}
          </span>
        )}
      </label>
    </div>
  );
}
