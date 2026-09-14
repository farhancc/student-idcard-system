'use client';

import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 1.25rem',
            borderRadius: '50%',
            background: '#fff7ed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
          }}
        >
          ⚠️
        </div>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600, color: '#111' }}>
          Dashboard Error
        </h2>
        <p style={{ margin: '0 0 1.25rem', color: '#666', lineHeight: 1.5 }}>
          Something went wrong loading this section. Your data is safe.
        </p>
        {error.digest && (
          <p style={{ margin: '0 0 1rem', color: '#999', fontSize: '0.8rem' }}>
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1.25rem',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#005ed4')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#0070f3')}
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            style={{
              padding: '0.5rem 1.25rem',
              background: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              transition: 'background 0.15s',
            }}
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
