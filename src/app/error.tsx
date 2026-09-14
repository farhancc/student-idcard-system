'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
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
            width: '64px',
            height: '64px',
            margin: '0 auto 1.5rem',
            borderRadius: '50%',
            background: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
          }}
        >
          ⚠️
        </div>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 600, color: '#111' }}>
          Something went wrong
        </h2>
        <p style={{ margin: '0 0 1.5rem', color: '#666', lineHeight: 1.5 }}>
          An unexpected error occurred. Please try again, or contact support if the issue persists.
        </p>
        {error.digest && (
          <p style={{ margin: '0 0 1rem', color: '#999', fontSize: '0.8rem' }}>
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            padding: '0.625rem 1.5rem',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#005ed4')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#0070f3')}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
