'use client';

import React, { useEffect, useRef, useState } from 'react';
import { renderCardSideClient } from '@/lib/pdf/card-renderer-client';

interface CardTemplate {
  id?: number;
  cardWidth: number;
  cardHeight: number;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  frontFields?: string | null;
  backFields?: string | null;
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
  forceWeb?: boolean;
}

export default function CardPreview({
  template,
  cardholder,
  side,
  pressFonts = [],
  validTill,
  className = '',
  style = {},
  forceWeb = false,
}: CardPreviewProps) {
  const [isElectron, setIsElectron] = useState(true);

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!(window as any).electronAPI);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imgUrl = side === 'front' ? template.frontImageUrl : (template.backImageUrl || template.frontImageUrl);

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

  const renderOnCanvas = (!imgUrl || forceWeb || cardholder) && (isElectron || forceWeb);

  useEffect(() => {
    if (!renderOnCanvas) return;
    let isMounted = true;

    async function draw() {
      if (!canvasRef.current) return;
      try {
        setLoading(true);
        setError(null);
        await renderCardSideClient(
          canvasRef.current,
          template as any,
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
  }, [template, cardholder, side, pressFonts, validTill, isElectron, forceWeb, renderOnCanvas]);

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    maxHeight: style.maxHeight || '100%',
    width: '100%',
    height: '100%',
    ...style,
  };

  // 1. If we have a direct static preview image URL (and not rendering live dynamic cardholder data on canvas), render high-res image
  if (imgUrl && !cardholder && !renderOnCanvas) {
    return (
      <div className={`relative flex items-center justify-center ${className}`} style={wrapperStyle}>
        <img
          src={imgUrl}
          alt={`${side.toUpperCase()} Preview`}
          style={{
            maxWidth: '100%',
            maxHeight: style.maxHeight || '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // 2. If rendering live on Canvas
  if (renderOnCanvas) {
    return (
      <div className={`relative flex items-center justify-center ${className}`} style={wrapperStyle}>
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
          style={{
            maxWidth: '100%',
            maxHeight: style.maxHeight || '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))',
            display: loading && !canvasRef.current ? 'none' : 'block',
          }}
          width={template.cardWidth || 1013}
          height={template.cardHeight || 638}
        />
      </div>
    );
  }

  // 3. Fallback if static image exists
  if (imgUrl) {
    return (
      <div className={`relative flex items-center justify-center ${className}`} style={wrapperStyle}>
        <img
          src={imgUrl}
          alt={`${side.toUpperCase()} Preview`}
          style={{
            maxWidth: '100%',
            maxHeight: style.maxHeight || '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // 4. Default empty state placeholder
  return (
    <div 
      className={`relative flex flex-col items-center justify-center border border-dashed border-muted-foreground/30 p-6 rounded-lg text-center bg-muted/20 ${className}`} 
      style={{ 
        maxWidth: '100%',
        maxHeight: style.maxHeight || '380px',
        aspectRatio: `${template.cardWidth || 1013} / ${template.cardHeight || 638}`,
        ...style 
      }}
    >
      <div className="flex flex-col items-center justify-center gap-2 p-4">
        <p className="text-sm font-semibold text-foreground/80">{side.toUpperCase()} SIDE PREVIEW</p>
        <p className="text-xs text-muted-foreground leading-snug max-w-[200px]">
          No preview image available yet.
        </p>
      </div>
    </div>
  );
}
