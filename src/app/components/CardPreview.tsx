'use client';

import React, { useEffect, useRef, useState } from 'react';
import { renderCardSideClient } from '@/lib/pdf/card-renderer-client';

interface CardTemplate {
  id?: number;
  cardWidth: number;
  cardHeight: number;
  frontImageUrl: string;
  backImageUrl: string | null;
  frontFields: string;
  backFields: string;
}

interface Cardholder {
  id?: number;
  name: string;
  designation?: string | null;
  photoUrl?: string | null;
  cardSerial?: string | null;
  customFields?: string | null;
  [key: string]: any;
}

interface PressFont {
  name: string;
  fileUrl: string;
}

interface CardPreviewProps {
  template: CardTemplate;
  cardholder?: Cardholder;
  side: 'front' | 'back';
  pressFonts?: PressFont[];
  validTill?: Date | string | null;
  className?: string;
  style?: React.CSSProperties;
}

export default function CardPreview({
  template,
  cardholder,
  side,
  pressFonts = [],
  validTill,
  className = '',
  style = {},
}: CardPreviewProps) {
  const [isElectron, setIsElectron] = useState(true);

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!(window as any).electronAPI);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Construct default preview dummy cardholder data if none provided
  const targetCardholder: Cardholder = cardholder || {
    id: 99,
    name: 'John Doe',
    designation: 'Student / Employee',
    photoUrl: null,
    cardSerial: 'STU-1234',
    customFields: JSON.stringify({
      bloodGroup: 'B+',
      rollNumber: '2026-99',
      schoolName: 'Greenwood High School',
    }),
  };

  const parsedValidTill = validTill
    ? typeof validTill === 'string'
      ? new Date(validTill)
      : validTill
    : (() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d;
      })();

  useEffect(() => {
    if (!isElectron) return;
    let isMounted = true;

    async function draw() {
      if (!canvasRef.current) return;
      try {
        setLoading(true);
        setError(null);
        await renderCardSideClient(
          canvasRef.current,
          template,
          targetCardholder,
          side,
          parsedValidTill,
          pressFonts
        );
      } catch (err: any) {
        console.error('Failed to render client preview:', err);
        if (isMounted) {
          setError(err?.message || 'Failed to render preview');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    draw();

    return () => {
      isMounted = false;
    };
  }, [template, cardholder, side, pressFonts, validTill, isElectron]);

  if (!isElectron) {
    return (
      <div 
        className={`relative flex flex-col items-center justify-center border border-dashed border-muted-foreground/30 p-6 rounded-lg text-center bg-muted/20 ${className}`} 
        style={{ 
          width: `${template.cardWidth}px`, 
          height: `${template.cardHeight}px`, 
          maxWidth: '100%',
          aspectRatio: `${template.cardWidth} / ${template.cardHeight}`,
          maxHeight: '380px',
          ...style 
        }}
      >
        <div className="flex flex-col items-center justify-center gap-2 p-4">
          <p className="text-sm font-semibold text-foreground/80">{side.toUpperCase()} SIDE PREVIEW</p>
          <p className="text-xs text-muted-foreground leading-snug max-w-[200px]">
            Real-time preview and graphics rendering is offloaded to the IDexo Desktop Client.
          </p>
          <div className="mt-2 text-xs px-2 py-1 bg-[#102650] text-white rounded font-medium shadow-sm">
            Desktop Client Only
          </div>
        </div>
      </div>
    );
  }

  // Use CSS scale or sizing to make it fit nicely
  const displayStyle: React.CSSProperties = {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    border: '1px solid var(--border)',
    display: loading && !canvasRef.current ? 'none' : 'block',
    ...style,
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ minHeight: '100px' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-destructive/10 text-destructive text-center rounded-lg z-10 border border-destructive/20">
          <span className="font-semibold text-sm">Preview Error</span>
          <span className="text-xs mt-1">{error}</span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={displayStyle}
        width={template.cardWidth}
        height={template.cardHeight}
      />
    </div>
  );
}
