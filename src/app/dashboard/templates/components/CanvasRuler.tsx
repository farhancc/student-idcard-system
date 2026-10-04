import React from 'react';
import { lengthToPx, pxToLength, unitSpec, type LengthUnit } from '@/lib/units';

/**
 * Ruler divisions per unit: the smallest division drawn, and how many of
 * those make a medium and a labelled major tick. A millimetre ruler is not
 * simply an inch ruler relabelled — inches divide in sixteenths, so the
 * spacing has to come from the unit rather than from a fixed 1 mm step.
 */
const RULER_DIVISIONS: Record<LengthUnit, { minor: number; perMedium: number; perMajor: number }> = {
  MM: { minor: 1, perMedium: 5, perMajor: 10 },      // labelled every 10 mm
  PT: { minor: 5, perMedium: 2, perMajor: 10 },      // labelled every 50 pt
  IN: { minor: 1 / 16, perMedium: 8, perMajor: 16 }, // labelled every inch
};

export interface Guide {
  id: string;
  type: 'horizontal' | 'vertical';
  value: number;
}

export interface ActiveGuideDrag {
  id: string;
  side: 'front' | 'back';
  type: 'horizontal' | 'vertical';
  isNew?: boolean;
}

export interface CanvasRulerProps {
  side: 'front' | 'back';
  type: 'horizontal' | 'vertical';
  cardWidth: number;
  cardHeight: number;
  zoom: number;
  unit: LengthUnit;
  onAddGuide: (guideId: string, side: 'front' | 'back', type: 'horizontal' | 'vertical') => void;
}

export function CanvasRuler({ side, type, cardWidth, cardHeight, zoom, unit, onAddGuide }: CanvasRulerProps) {
  const isHoriz = type === 'horizontal';
  const length = isHoriz ? cardWidth : cardHeight;
  const editorWidth = 480 * zoom;
  const displayLength = isHoriz ? editorWidth : (editorWidth / cardWidth) * cardHeight;
  const scale = editorWidth / cardWidth;

  const { minor, perMedium, perMajor } = RULER_DIVISIONS[unit];
  const ticks = [];
  const divisions = Math.floor(pxToLength(length, unit) / minor);
  for (let i = 0; i <= divisions; i += 1) {
    const isMajor = i % perMajor === 0;
    ticks.push({
      // Labelled ticks fall on whole units, so the label stays a round number.
      val: Number((i * minor).toFixed(isMajor ? 0 : 3)),
      pos: lengthToPx(i * minor, unit) * scale,
      isMajor,
      isMedium: i % perMedium === 0 && !isMajor,
    });
  }

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        const id = `guide_${Date.now()}`;
        onAddGuide(id, side, type);
      }}
      style={{
        position: 'absolute',
        left: isHoriz ? '20px' : '0',
        top: isHoriz ? '0' : '20px',
        width: isHoriz ? `${displayLength}px` : '20px',
        height: isHoriz ? '20px' : `${displayLength}px`,
        background: '#0f172a',
        borderBottom: isHoriz ? '1px solid #334155' : 'none',
        borderRight: !isHoriz ? '1px solid #334155' : 'none',
        cursor: isHoriz ? 'ns-resize' : 'ew-resize',
        userSelect: 'none',
        zIndex: 400
      }}
      title={`Drag to create a ${isHoriz ? 'horizontal' : 'vertical'} guideline (units: ${unitSpec(unit).symbol})`}
    >
      <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {ticks.map((t, idx) => {
          if (isHoriz) {
            return (
              <React.Fragment key={idx}>
                <line
                  x1={t.pos}
                  y1={t.isMajor ? 0 : (t.isMedium ? 5 : 10)}
                  x2={t.pos}
                  y2="20"
                  stroke="#475569"
                  strokeWidth="1"
                />
                {t.isMajor && (
                  <text
                    x={t.pos + 2}
                    y="10"
                    fill="#94a3b8"
                    fontSize="7px"
                    fontFamily="monospace"
                  >
                    {t.val}
                  </text>
                )}
              </React.Fragment>
            );
          } else {
            return (
              <React.Fragment key={idx}>
                <line
                  x1={t.isMajor ? 0 : (t.isMedium ? 5 : 10)}
                  y1={t.pos}
                  x2="20"
                  y2={t.pos}
                  stroke="#475569"
                  strokeWidth="1"
                />
                {t.isMajor && (
                  <text
                    x="2"
                    y={t.pos + 8}
                    fill="#94a3b8"
                    fontSize="7px"
                    fontFamily="monospace"
                    style={{ transform: `rotate(-90deg)`, transformOrigin: `2px ${t.pos - 2}px` }}
                  >
                    {t.val}
                  </text>
                )}
              </React.Fragment>
            );
          }
        })}
      </svg>
    </div>
  );
}

export interface GuideDifferencesProps {
  side: 'front' | 'back';
  activeGuideDrag: ActiveGuideDrag | null;
  zoom: number;
  cardWidth: number;
  unit: LengthUnit;
  frontGuides: Guide[];
  backGuides: Guide[];
}

export function GuideDifferences({ side, activeGuideDrag, zoom, cardWidth, unit, frontGuides, backGuides }: GuideDifferencesProps) {
  if (!activeGuideDrag || activeGuideDrag.side !== side) return null;
  
  const scale = (480 * zoom) / cardWidth;
  const guides = side === 'front' ? frontGuides : backGuides;
  const sameTypeGuides = guides
    .filter(g => g.type === activeGuideDrag.type)
    .sort((a, b) => a.value - b.value);
  
  const dragIdx = sameTypeGuides.findIndex(g => g.id === activeGuideDrag.id);
  if (dragIdx === -1) return null;
  
  const dragged = sameTypeGuides[dragIdx];
  const prev = dragIdx > 0 ? sameTypeGuides[dragIdx - 1] : null;
  const next = dragIdx < sameTypeGuides.length - 1 ? sameTypeGuides[dragIdx + 1] : null;
  
  const indicators = [];
  
  if (prev) {
    const distPx = dragged.value - prev.value;
    if (distPx > 0) {
      indicators.push({
        id: 'prev',
        from: prev.value,
        to: dragged.value,
        dist: pxToLength(distPx, unit),
        offsetPct: '35%'
      });
    }
  }
  
  if (next) {
    const distPx = next.value - dragged.value;
    if (distPx > 0) {
      indicators.push({
        id: 'next',
        from: dragged.value,
        to: next.value,
        dist: pxToLength(distPx, unit),
        offsetPct: '65%'
      });
    }
  }
  
  return indicators.map((ind) => {
    const isHoriz = activeGuideDrag.type === 'horizontal';
    const start = ind.from * scale;
    const end = ind.to * scale;
    const length = end - start;
    
    if (isHoriz) {
      return (
        <div
          key={ind.id}
          style={{
            position: 'absolute',
            left: ind.offsetPct,
            top: `${start}px`,
            width: '1px',
            height: `${length}px`,
            background: 'rgba(6, 182, 212, 0.75)',
            zIndex: 390,
            pointerEvents: 'none',
            fontFamily: 'monospace'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: '-4px', width: '9px', height: '1px', background: 'rgba(6, 182, 212, 0.9)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: '-4px', width: '9px', height: '1px', background: 'rgba(6, 182, 212, 0.9)' }} />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#0891b2',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              padding: '2px 6px',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            {ind.dist} {unitSpec(unit).symbol}
          </div>
        </div>
      );
    } else {
      return (
        <div
          key={ind.id}
          style={{
            position: 'absolute',
            top: ind.offsetPct,
            left: `${start}px`,
            width: `${length}px`,
            height: '1px',
            background: 'rgba(6, 182, 212, 0.75)',
            zIndex: 390,
            pointerEvents: 'none',
            fontFamily: 'monospace'
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: '-4px', width: '1px', height: '9px', background: 'rgba(6, 182, 212, 0.9)' }} />
          <div style={{ position: 'absolute', right: 0, top: '-4px', width: '1px', height: '9px', background: 'rgba(6, 182, 212, 0.9)' }} />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#0891b2',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              padding: '2px 6px',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            {ind.dist} {unitSpec(unit).symbol}
          </div>
        </div>
      );
    }
  });
}
