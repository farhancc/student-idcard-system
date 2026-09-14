'use client';
import React from 'react';

export function CardLivePreview({
  template,
  cardholder,
  side,
}: {
  template: any;
  cardholder: any;
  side: 'front' | 'back';
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canvasRef.current || !template) return;
    let cancelled = false;
    setRendering(true);
    setError(null);

    (async () => {
      try {
        const { renderCardSideClient, normalizeGoogleDriveUrl } = await import('@/lib/pdf/card-renderer-client');
        if (cancelled) return;
        await renderCardSideClient(
          canvasRef.current!,
          {
            id: template.id,
            cardWidth: template.cardWidth,
            cardHeight: template.cardHeight,
            frontImageUrl: template.frontImageUrl || '',
            backImageUrl: template.backImageUrl || null,
            frontOriginalUrl: template.frontOriginalUrl || null,
            backOriginalUrl: template.backOriginalUrl || null,
            frontFields: template.frontFields || '[]',
            backFields: template.backFields || '[]',
          },
          {
            id: cardholder.id,
            name: cardholder.name,
            designation: cardholder.designation,
            photoUrl: normalizeGoogleDriveUrl(cardholder.photoUrl) || cardholder.photoUrl,
            cardSerial: cardholder.cardSerial,
            uniqueKey: cardholder.uniqueKey,
            customFields: cardholder.customFields,
          },
          side,
          null,  // validTillDate — will be resolved from customFields by renderer
          [],    // pressFonts — would need separate fetch; renderer falls back to system fonts
          2      // 2× scale for crisp display
        );
        if (!cancelled) setRendering(false);
      } catch (err: any) {
        if (!cancelled) {
          setError('Preview unavailable');
          setRendering(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [template, cardholder, side]);

  const cardW = template?.cardWidth ?? 320;
  const cardH = template?.cardHeight ?? 200;
  // Scale canvas to fit within ~480px width
  const maxDisplayW = 480;
  const displayScale = Math.min(1, maxDisplayW / cardW);
  const displayW = cardW * displayScale;
  const displayH = cardH * displayScale;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: `${displayW}px`,
          height: `${displayH}px`,
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'block',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      />
      {rendering && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '10px',
          background: 'rgba(13,16,27,0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted)', fontSize: '0.8rem', gap: '8px',
        }}>
          <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Rendering…
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '10px',
          background: 'rgba(13,16,27,0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#f87171', fontSize: '0.8rem',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
