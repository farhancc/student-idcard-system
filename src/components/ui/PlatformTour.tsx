'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';

const TOUR_STORAGE_KEY = 'idexo_tour_v1_done';

interface TourStep {
  targetId?: string;
  position?: 'right' | 'left' | 'bottom' | 'top';
  icon: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    icon: '👋',
    title: 'Welcome to IDexo Press!',
    body: "You're now inside the IDexo printing management platform. This quick tour will show you around so you can get up and running in minutes.",
  },
  {
    targetId: 'nav-overview',
    position: 'right',
    icon: '📊',
    title: 'Overview Dashboard',
    body: 'Your command center. See real-time metrics — active orders, completed jobs, revenue, and recent activity at a glance.',
  },
  {
    targetId: 'nav-clients',
    position: 'right',
    icon: '🏫',
    title: 'Client Registries',
    body: 'Start here. Register the schools, companies, and organizations you print cards for. Each client gets their own directory of cardholders.',
  },
  {
    targetId: 'nav-templates',
    position: 'right',
    icon: '🎨',
    title: 'Card Templates',
    body: 'Design ID card layouts using the visual drag-and-drop editor. Upload your PDF/SVG background, then map fields like name, photo, and QR codes.',
  },
  {
    targetId: 'nav-orders',
    position: 'right',
    icon: '📋',
    title: 'Orders',
    body: 'Create card printing orders for your clients. Import cardholder data via CSV, assign a template, and send the job to production.',
  },
  {
    targetId: 'nav-pdf-jobs',
    position: 'right',
    icon: '🖨️',
    title: 'PDF Production Queue',
    body: "Monitor live print jobs from the desktop client. Cards are rendered and queued here as PDFs, ready for the physical printer.",
  },
  {
    targetId: 'nav-marketplace',
    position: 'right',
    icon: '🛒',
    title: 'Template Marketplace',
    body: 'Browse and purchase ready-made professional ID card templates. You can also sell your own designs and earn credits.',
  },
  {
    targetId: 'tour-credits',
    position: 'right',
    icon: '💳',
    title: 'Print Credits',
    body: 'Credits are consumed when you produce card PDFs. Keep an eye on your balance here. Contact your admin to top up.',
  },
  {
    targetId: 'nav-settings',
    position: 'right',
    icon: '⚙️',
    title: 'Settings',
    body: "Configure your press profile, manage team members, update billing details, and customise notification preferences.",
  },
  {
    icon: '🚀',
    title: "You're all set!",
    body: "That covers the essentials. Click a section from the sidebar to get started. You can reopen this tour anytime from the sidebar.",
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function PlatformTour({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  // If targetId is set but element not found, fall back to centered display
  const [fallbackCentered, setFallbackCentered] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  // Centered when: no targetId defined OR element not found in DOM
  const isCentered = !currentStep.targetId || fallbackCentered;

  const computePositions = useCallback((s: TourStep) => {
    if (!s.targetId) {
      setSpotlight(null);
      setTooltipPos(null);
      setFallbackCentered(false);
      return;
    }
    const el = document.getElementById(s.targetId);
    if (!el) {
      // Graceful fallback: show tooltip centered, no spotlight
      setSpotlight(null);
      setTooltipPos(null);
      setFallbackCentered(true);
      return;
    }
    setFallbackCentered(false);
    const rect = el.getBoundingClientRect();
    const PADDING = 8;
    setSpotlight({
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    });

    const TOOLTIP_W = 320;
    const TOOLTIP_GAP = 16;
    const pos = s.position || 'right';
    let top = 0;
    let left = 0;
    if (pos === 'right') {
      top = rect.top + rect.height / 2 - 80;
      left = rect.right + TOOLTIP_GAP;
    } else if (pos === 'left') {
      top = rect.top + rect.height / 2 - 80;
      left = rect.left - TOOLTIP_W - TOOLTIP_GAP;
    } else if (pos === 'bottom') {
      top = rect.bottom + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    } else if (pos === 'top') {
      top = rect.top - TOOLTIP_GAP - 160;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    left = Math.max(12, Math.min(left, vw - TOOLTIP_W - 12));
    top = Math.max(12, Math.min(top, vh - 200));
    setTooltipPos({ top, left });
  }, []);

  // Recompute when step or visibility changes
  useEffect(() => {
    if (visible) computePositions(currentStep);
  }, [step, visible, currentStep, computePositions]);

  useEffect(() => {
    const handler = () => { if (visible) computePositions(currentStep); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [visible, currentStep, computePositions]);

  // Show tour on first visit
  useEffect(() => {
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      setTimeout(() => setVisible(true), 800);
    }
  }, []);

  // No animating guard — direct state update so buttons always respond
  const handleNext = () => {
    if (isLast) {
      dismiss(true);
    } else {
      setStep(s => s + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) setStep(s => s - 1);
  };

  const dismiss = (completed: boolean) => {
    if (completed) localStorage.setItem(TOUR_STORAGE_KEY, '1');
    setVisible(false);
    onComplete?.();
  };

  if (!visible) return null;

  return (
    <>
      {/* Dark overlay — pointer-events only when no spotlight so backdrop blocks page interaction */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: spotlight ? 'transparent' : 'rgba(0,0,0,0.72)',
          backdropFilter: spotlight ? 'none' : 'blur(2px)',
          pointerEvents: spotlight ? 'none' : 'auto',
          transition: 'background 0.3s ease',
        }}
      />

      {/* SVG spotlight cutout */}
      {spotlight && (
        <svg
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <defs>
            <mask id="tour-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={10}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.72)"
            mask="url(#tour-spotlight-mask)"
          />
          {/* Indigo glow ring around spotlight */}
          <rect
            x={spotlight.left - 1}
            y={spotlight.top - 1}
            width={spotlight.width + 2}
            height={spotlight.height + 2}
            rx={11}
            fill="none"
            stroke="rgba(99,102,241,0.85)"
            strokeWidth="2"
          />
        </svg>
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          zIndex: 10000,
          width: '320px',
          ...(isCentered
            ? {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }
            : tooltipPos
            ? {
                top: `${tooltipPos.top}px`,
                left: `${tooltipPos.left}px`,
              }
            : { display: 'none' }),
          transition: 'top 0.35s cubic-bezier(0.4,0,0.2,1), left 0.35s cubic-bezier(0.4,0,0.2,1)',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%)',
          border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Step progress dots */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '16px', justifyContent: isCentered ? 'center' : 'flex-start' }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? '20px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === step
                  ? 'linear-gradient(90deg, #6366f1, #a855f7)'
                  : i < step
                  ? 'rgba(99,102,241,0.5)'
                  : 'rgba(255,255,255,0.1)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Emoji icon */}
        <div style={{ fontSize: isCentered ? '3rem' : '2rem', marginBottom: '12px', textAlign: isCentered ? 'center' : 'left', lineHeight: 1 }}>
          {currentStep.icon}
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: isCentered ? '1.4rem' : '1.1rem',
          fontWeight: 700,
          margin: '0 0 10px',
          textAlign: isCentered ? 'center' : 'left',
          background: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          {currentStep.title}
        </h3>

        {/* Body */}
        <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#94a3b8', margin: '0 0 20px', textAlign: isCentered ? 'center' : 'left' }}>
          {currentStep.body}
        </p>

        {/* Step counter */}
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: '16px', textAlign: isCentered ? 'center' : 'left' }}>
          Step {step + 1} of {STEPS.length}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: isCentered ? 'center' : 'space-between', alignItems: 'center' }}>
          {!isLast && (
            <button
              onClick={() => dismiss(false)}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', flexShrink: 0 }}
            >
              Skip tour
            </button>
          )}

          <div style={{ display: 'flex', gap: '8px', marginLeft: isLast ? 'auto' : undefined }}>
            {!isFirst && (
              <button
                onClick={handleBack}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', padding: '8px 16px', cursor: 'pointer' }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNext}
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, padding: '8px 20px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}
            >
              {isLast ? '🎉 Get Started' : 'Next →'}
            </button>
          </div>
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={() => dismiss(false)}
        title="Close tour"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10001,
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          fontSize: '1.1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
        }}
      >
        ✕
      </button>
    </>
  );
}

// Call this to reset the tour so it shows on next load
export function resetTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  window.location.reload();
}
