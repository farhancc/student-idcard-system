'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

const TOUR_STORAGE_KEY = 'idexo_tour_v1_done';

interface TourStep {
  targetId?: string;
  position?: 'right' | 'left' | 'bottom' | 'top';
  icon: string;
  title: string;
  body: string;
  /** Navigate to this path before showing the step */
  navigateTo?: string;
  /** Label shown on the primary action button (defaults to "Next →") */
  nextLabel?: string;
}

const STEPS: TourStep[] = [
  // ─── PHASE 1: Platform Overview ────────────────────────────────────────────
  {
    icon: '👋',
    title: 'Welcome to IDexo Press!',
    body: "You're now inside the IDexo printing management platform. This quick tour will show you around so you can get up and running in minutes.",
    nextLabel: "Let's go →",
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
    body: 'Register schools, companies, and organizations you print cards for. Each client gets their own directory of cardholders.',
  },
  {
    targetId: 'nav-templates',
    position: 'right',
    icon: '🎨',
    title: 'Card Templates',
    body: 'Design ID card layouts with the visual editor. Upload your background design, then map fields like name, photo, and QR codes.',
  },
  {
    targetId: 'nav-orders',
    position: 'right',
    icon: '📋',
    title: 'Orders',
    body: 'Create card printing orders for your clients. Import cardholder data via CSV, assign a template, and queue the job.',
  },
  {
    targetId: 'nav-pdf-jobs',
    position: 'right',
    icon: '🖨️',
    title: 'PDF Production Queue',
    body: "Monitor live print jobs from the desktop client. Cards are rendered as PDFs here, ready for the physical printer.",
  },
  {
    targetId: 'nav-marketplace',
    position: 'right',
    icon: '🛒',
    title: 'Template Marketplace',
    body: 'Browse and purchase professional ID card templates. Sell your own designs and earn credits.',
  },
  {
    targetId: 'tour-credits',
    position: 'right',
    icon: '💳',
    title: 'Print Credits',
    body: 'Credits are consumed when producing card PDFs. Keep an eye on your balance here and top up via your admin.',
  },
  {
    targetId: 'nav-settings',
    position: 'right',
    icon: '⚙️',
    title: 'Settings',
    body: "Configure your press profile, manage team members, update billing details, and customise notifications.",
  },

  // ─── PHASE 2: Create your first Client ─────────────────────────────────────
  {
    icon: '🚀',
    title: "Now let's get you set up!",
    body: "Great — you know the layout. Next we'll walk you through creating your first client, designing a template, and sharing the enrollment link. About 3 minutes.",
    nextLabel: "Start setup →",
  },
  {
    navigateTo: '/dashboard/clients',
    icon: '🏫',
    title: 'Step 1 — Register a Client',
    body: "A client is the organization you are printing cards for (e.g. a school or company). Let's create your first one now.",
    nextLabel: 'Show me →',
  },
  {
    navigateTo: '/dashboard/clients',
    targetId: 'btn-register-client',
    position: 'bottom',
    icon: '➕',
    title: 'Click "Register Client"',
    body: 'Click this button to open the registration form. Fill in the organization name, contact details, and address, then hit Save.',
    nextLabel: 'Got it →',
  },
  {
    navigateTo: '/dashboard/clients',
    icon: '✅',
    title: 'Client saved!',
    body: "Your client is registered. Now let's head to Templates to design the ID card layout — we'll come back here afterwards to generate and share the portal link.",
    nextLabel: 'Next: Design a Template →',
  },

  // ─── PHASE 3: Create your first Template ────────────────────────────────────
  {
    navigateTo: '/dashboard/templates',
    icon: '🎨',
    title: 'Step 2 — Create a Template',
    body: "A template defines the visual layout of the ID card — fields, fonts, and background design. You need at least one template assigned to your client before generating a portal link.",
    nextLabel: 'Show me →',
  },
  {
    navigateTo: '/dashboard/templates',
    targetId: 'btn-create-template',
    position: 'bottom',
    icon: '➕',
    title: 'Click "+ Create Template"',
    body: "Click here to open the template builder. Name your template, upload your PDF/SVG background, and start mapping fields like Name, Photo, and QR Code.",
    nextLabel: 'Got it →',
  },
  {
    navigateTo: '/dashboard/templates',
    icon: '🗺️',
    title: 'Map your fields',
    body: "Drag and position fields on the card canvas — Name, Photo, Designation, QR Code, and more. Once saved, assign the template to your client so it appears in the portal link generator.",
    nextLabel: "Now let's share the link →",
  },

  // ─── PHASE 4: Share the Client Portal Link ───────────────────────────────────
  {
    icon: '🔗',
    title: 'Step 3 — Share the Client Portal',
    body: "Every client gets a secure portal link. You send it to the organization head — they enroll members, manage departments, and collect photos without needing a press account.",
    nextLabel: 'Show me →',
  },
  {
    navigateTo: '/dashboard/clients',
    icon: '📂',
    title: 'Back to the client directory',
    body: "We're heading back to Clients now. Click on your client card to open its full directory where the Portal Links tab lives.",
    nextLabel: 'Got it →',
  },
  {
    targetId: 'btn-portal-tab',
    position: 'bottom',
    icon: '🔗',
    title: 'Click "Client Portal Links" tab',
    body: 'Inside the client directory, switch to the Portal Links tab. This is where you generate and manage secure enrollment links for the organization.',
    nextLabel: 'Got it →',
  },
  {
    targetId: 'btn-generate-links',
    position: 'top',
    icon: '⚡',
    title: 'Generate the portal link',
    body: 'Select the template you just created from the dropdown, then click "Generate Links". The Organization Head link and the Enrollment link will appear below.',
    nextLabel: 'Got it →',
  },
  {
    icon: '📤',
    title: 'Copy & share the link',
    body: "Click Copy next to the Organization Head Portal Link and send it to your client contact. They log in, set up department heads, and distribute enrollment forms — no press account needed!",
    nextLabel: "All done →",
  },

  // ─── PHASE 5: Done ───────────────────────────────────────────────────────────
  {
    icon: '🎉',
    title: "You're all set!",
    body: "Client ✓  Template ✓  Portal link ✓  You're ready to create your first order. Go to Orders, pick a client and template, import your cardholder CSV, and produce cards!",
    nextLabel: '🎉 Let\'s go!',
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function PlatformTour({ onComplete }: { onComplete?: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [fallbackCentered, setFallbackCentered] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const isCentered = !currentStep.targetId || fallbackCentered;

  // Phase labels for the divider dots
  const PHASE_BOUNDARIES = [0, 9, 13, 16, 21]; // Overview, Client, Template, Portal, Done
  const phaseOf = (i: number) => PHASE_BOUNDARIES.findLastIndex((b) => i >= b);

  const computePositions = useCallback((s: TourStep) => {
    if (!s.targetId) {
      setSpotlight(null);
      setTooltipPos(null);
      setFallbackCentered(false);
      return;
    }
    const el = document.getElementById(s.targetId);
    if (!el) {
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
    const tooltipH = tooltipRef.current ? tooltipRef.current.offsetHeight : 340;
    const MARGIN = 16;
    left = Math.max(MARGIN, Math.min(left, vw - TOOLTIP_W - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - tooltipH - MARGIN));
    setTooltipPos({ top, left });
  }, []);

  useEffect(() => {
    if (visible) {
      computePositions(currentStep);
      const raf = requestAnimationFrame(() => computePositions(currentStep));
      return () => cancelAnimationFrame(raf);
    }
  }, [step, visible, currentStep, computePositions]);

  useEffect(() => {
    const handler = () => { if (visible) computePositions(currentStep); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [visible, currentStep, computePositions]);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      setTimeout(() => setVisible(true), 800);
    }
  }, []);

  const goToStep = useCallback((nextStep: number) => {
    const target = STEPS[nextStep];
    if (target?.navigateTo) {
      setNavigating(true);
      setSpotlight(null);
      setTooltipPos(null);
      router.push(target.navigateTo);
      // Wait for page transition then advance
      setTimeout(() => {
        setStep(nextStep);
        setNavigating(false);
      }, 600);
    } else {
      setStep(nextStep);
    }
  }, [router]);

  const handleNext = () => {
    if (isLast) {
      dismiss(true);
    } else {
      goToStep(step + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) goToStep(step - 1);
  };

  const dismiss = (completed: boolean) => {
    if (completed) localStorage.setItem(TOUR_STORAGE_KEY, '1');
    setVisible(false);
    onComplete?.();
  };

  if (!visible) return null;

  // Phase indicator (5 phases)
  const PHASE_NAMES = ['Overview', 'Client', 'Template', 'Portal', 'Done'];
  const currentPhase = phaseOf(step);

  return (
    <>
      {/* Dark overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: (spotlight && !navigating) ? 'transparent' : 'rgba(0,0,0,0.72)',
          backdropFilter: (spotlight && !navigating) ? 'none' : 'blur(2px)',
          pointerEvents: (spotlight && !navigating) ? 'none' : 'auto',
          transition: 'background 0.3s ease',
        }}
      />

      {/* SVG spotlight cutout */}
      {spotlight && !navigating && (
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

      {/* Loading indicator during navigation */}
      {navigating && (
        <div style={{
          position: 'fixed',
          zIndex: 10000,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          color: '#fff',
          fontSize: '0.9rem',
        }}>
          <div style={{
            width: '36px', height: '36px', border: '3px solid rgba(99,102,241,0.3)',
            borderTop: '3px solid #6366f1', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          Navigating…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Tooltip card */}
      {!navigating && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            zIndex: 10000,
            width: '340px',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            ...(isCentered
              ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
              : tooltipPos
              ? { top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px` }
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
          {/* Phase tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {PHASE_NAMES.map((name, i) => (
              <div key={i} style={{
                flex: 1,
                height: '3px',
                borderRadius: '2px',
                background: i < currentPhase
                  ? 'rgba(99,102,241,0.5)'
                  : i === currentPhase
                  ? 'linear-gradient(90deg, #6366f1, #a855f7)'
                  : 'rgba(255,255,255,0.08)',
                transition: 'all 0.3s ease',
              }} title={name} />
            ))}
          </div>

          {/* Phase label */}
          <div style={{ fontSize: '0.65rem', color: 'rgba(99,102,241,0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            {PHASE_NAMES[currentPhase]}
          </div>

          {/* Icon */}
          <div style={{ fontSize: isCentered ? '2.5rem' : '1.8rem', marginBottom: '10px', textAlign: isCentered ? 'center' : 'left', lineHeight: 1 }}>
            {currentStep.icon}
          </div>

          {/* Title */}
          <h3 style={{
            fontSize: isCentered ? '1.3rem' : '1.05rem',
            fontWeight: 700,
            margin: '0 0 8px',
            textAlign: isCentered ? 'center' : 'left',
            background: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {currentStep.title}
          </h3>

          {/* Body */}
          <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#94a3b8', margin: '0 0 16px', textAlign: isCentered ? 'center' : 'left' }}>
            {currentStep.body}
          </p>

          {/* Step counter */}
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginBottom: '14px', textAlign: isCentered ? 'center' : 'left' }}>
            Step {step + 1} of {STEPS.length}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: isCentered ? 'center' : 'space-between', alignItems: 'center' }}>
            {!isLast && (
              <button
                onClick={() => dismiss(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.28)', fontSize: '0.72rem', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', flexShrink: 0 }}
              >
                Skip tour
              </button>
            )}
            <div style={{ display: 'flex', gap: '8px', marginLeft: isLast ? 'auto' : undefined }}>
              {!isFirst && (
                <button
                  onClick={handleBack}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', padding: '8px 14px', cursor: 'pointer' }}
                >
                  ← Back
                </button>
              )}
              <button
                onClick={handleNext}
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, padding: '8px 20px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(99,102,241,0.4)', whiteSpace: 'nowrap' }}
              >
                {currentStep.nextLabel ?? (isLast ? '🎉 Finish' : 'Next →')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close (✕) button */}
      {!navigating && (
        <button
          onClick={() => dismiss(false)}
          title="Close tour"
          style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 10001,
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: '1.1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)',
          }}
        >
          ✕
        </button>
      )}
    </>
  );
}

// Call this to reset the tour so it shows on next load
export function resetTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  window.location.reload();
}
