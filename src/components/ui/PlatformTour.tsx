'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

const TOUR_STORAGE_KEY = 'idexo_tour_v1_done';
const TOUR_STEP_KEY   = 'idexo_tour_v1_step';

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
  /**
   * When true the "Next" button is hidden and the tour advances only
   * when the user physically clicks the spotlit element.
   */
  waitForClick?: boolean;
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
    body: "A client is the organization you are printing cards for (e.g. a school or company). Click the button below to open the registration form.",
    nextLabel: 'Show me →',
  },
  {
    navigateTo: '/dashboard/clients',
    targetId: 'btn-register-client',
    position: 'bottom',
    icon: '➕',
    title: 'Click "Register Client"',
    body: 'Click the highlighted button to open the registration form.',
    waitForClick: true,
  },
  {
    navigateTo: '/dashboard/clients',
    targetId: 'btn-save-client',
    position: 'bottom',
    icon: '📝',
    title: 'Fill form & click "Save Organization"',
    body: 'Fill in the organization name and contact details, then click the highlighted "Save Organization" button below.',
    waitForClick: true,
  },
  {
    navigateTo: '/dashboard/clients',
    icon: '✅',
    title: 'Client saved!',
    body: "Your client is registered! Now let's head to Templates to design their ID card layout.",
    nextLabel: 'Next: Design a Template →',
  },

  // ─── PHASE 3: Create your first Template ────────────────────────────────────
  {
    navigateTo: '/dashboard/templates',
    icon: '🎨',
    title: 'Step 2 — Create a Template',
    body: "A template defines the visual layout of the ID card — fields, fonts, and background design. You need at least one before you can generate a portal link.",
    nextLabel: 'Show me →',
  },
  {
    navigateTo: '/dashboard/templates',
    targetId: 'btn-create-template',
    position: 'bottom',
    icon: '➕',
    title: 'Click "+ Create Template"',
    body: 'Click the highlighted button to open the template designer setup.',
    waitForClick: true,
  },
  {
    navigateTo: '/dashboard/templates',
    targetId: 'btn-save-template',
    position: 'top',
    icon: '🛠️',
    title: 'Design & click "Save Template"',
    body: 'Name your template, upload front/back background images, map coordinate fields, then click "Save Template".',
    waitForClick: true,
  },
  {
    navigateTo: '/dashboard/templates',
    icon: '🎨',
    title: 'Template saved!',
    body: "Awesome! Template created. Now let's head back to Clients to generate and share the portal link.",
    nextLabel: 'Next: Share Portal Link →',
  },

  // ─── PHASE 4: Share the Client Portal Link ───────────────────────────────────
  {
    icon: '🔗',
    title: 'Step 3 — Share the Client Portal',
    body: "Every client gets a secure portal link. Send it to the organization head — they enroll members, manage departments, and collect photos without needing a press account.",
    nextLabel: 'Show me →',
  },
  {
    navigateTo: '/dashboard/clients',
    targetId: 'btn-open-client',
    position: 'bottom',
    icon: '📂',
    title: 'Open your Client Directory',
    body: 'Click on your client card to open its directory dashboard where portal links live.',
    waitForClick: true,
  },
  {
    targetId: 'btn-portal-tab',
    position: 'bottom',
    icon: '🔗',
    title: 'Click "Client Portal Links" tab',
    body: 'Click the highlighted tab to switch to the Portal Links section.',
    waitForClick: true,
  },
  {
    targetId: 'btn-generate-links',
    position: 'top',
    icon: '⚡',
    title: 'Select template & click "Generate Links"',
    body: 'Select the template you just created from the dropdown, then click "Generate Links" to create the Organization Head and Enrollment links.',
    waitForClick: true,
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
    nextLabel: "🎉 Let's go!",
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
  const isWaitingForClick = !!(currentStep.waitForClick && currentStep.targetId && spotlight && !fallbackCentered);

  // Phase labels
  const PHASE_BOUNDARIES = [0, 9, 13, 16, 21]; // Overview, Client, Template, Portal, Done
  const PHASE_NAMES = ['Overview', 'Client', 'Template', 'Portal', 'Done'];
  const phaseOf = (i: number) => PHASE_BOUNDARIES.findLastIndex((b) => i >= b);
  const currentPhase = phaseOf(step);

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

    const TOOLTIP_W = 340;
    const TOOLTIP_GAP = 18;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tooltipH = tooltipRef.current ? tooltipRef.current.offsetHeight : 320;

    let preferredPos = s.position || 'bottom';

    // Auto-flip position if preferred pos would clip offscreen or cover target
    if (preferredPos === 'top' && rect.top - TOOLTIP_GAP - tooltipH < 16) {
      if (rect.bottom + TOOLTIP_GAP + tooltipH <= vh - 16) {
        preferredPos = 'bottom';
      } else if (rect.left - TOOLTIP_W - TOOLTIP_GAP >= 16) {
        preferredPos = 'left';
      }
    } else if (preferredPos === 'bottom' && rect.bottom + TOOLTIP_GAP + tooltipH > vh - 16) {
      if (rect.top - TOOLTIP_GAP - tooltipH >= 16) {
        preferredPos = 'top';
      } else if (rect.left - TOOLTIP_W - TOOLTIP_GAP >= 16) {
        preferredPos = 'left';
      }
    }

    let top = 0;
    let left = 0;
    if (preferredPos === 'right') {
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.right + TOOLTIP_GAP + PADDING;
    } else if (preferredPos === 'left') {
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left - TOOLTIP_W - TOOLTIP_GAP - PADDING;
    } else if (preferredPos === 'bottom') {
      top = rect.bottom + TOOLTIP_GAP + PADDING;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    } else if (preferredPos === 'top') {
      top = rect.top - TOOLTIP_GAP - tooltipH - PADDING;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    }

    const MARGIN = 16;
    left = Math.max(MARGIN, Math.min(left, vw - TOOLTIP_W - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - tooltipH - MARGIN));
    setTooltipPos({ top, left });
  }, []);

  // Recompute spotlight on step/visibility change & scroll target into view
  useEffect(() => {
    if (visible) {
      if (currentStep.targetId) {
        const el = document.getElementById(currentStep.targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      computePositions(currentStep);
      const raf = requestAnimationFrame(() => computePositions(currentStep));
      return () => cancelAnimationFrame(raf);
    }
  }, [step, visible, currentStep, computePositions]);

  // Recompute on resize
  useEffect(() => {
    const handler = () => { if (visible) computePositions(currentStep); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [visible, currentStep, computePositions]);

  // Persist step on every change so full-page reloads can resume
  useEffect(() => {
    if (visible) sessionStorage.setItem(TOUR_STEP_KEY, String(step));
  }, [step, visible]);

  // Auto-show on first visit; resume from saved step if mid-tour
  useEffect(() => {
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      const saved = sessionStorage.getItem(TOUR_STEP_KEY);
      const resumeAt = saved ? Math.min(parseInt(saved, 10), STEPS.length - 1) : 0;
      if (resumeAt > 0) {
        // Resume immediately (no delay) at the saved step
        setStep(resumeAt);
        setVisible(true);
      } else {
        setTimeout(() => setVisible(true), 800);
      }
    }
  }, []);

  const goToStep = useCallback((nextStep: number) => {
    const target = STEPS[nextStep];
    if (target?.navigateTo) {
      setNavigating(true);
      setSpotlight(null);
      setTooltipPos(null);
      router.push(target.navigateTo);
      setTimeout(() => {
        setStep(nextStep);
        setNavigating(false);
      }, 600);
    } else {
      setStep(nextStep);
    }
  }, [router]);

  // ── waitForClick: attach a native click listener to the target element ──────
  useEffect(() => {
    if (!visible || !currentStep.waitForClick || !currentStep.targetId) return;
    const el = document.getElementById(currentStep.targetId);
    if (!el) return;

    const advance = () => {
      // Let the element's own click handler fire first, then move the tour
      setTimeout(() => {
        if (!isLast) goToStep(step + 1);
        else dismiss(true);
      }, 120);
    };

    el.addEventListener('click', advance);
    return () => el.removeEventListener('click', advance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step, currentStep]);

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
    // Always mark as done — whether completed OR skipped/closed.
    // The only way to see the tour again is via Settings → Restart Tour.
    localStorage.setItem(TOUR_STORAGE_KEY, completed ? 'completed' : 'dismissed');
    sessionStorage.removeItem(TOUR_STEP_KEY); // clear saved step
    setVisible(false);
    onComplete?.();
  };

  if (!visible) return null;

  return (
    <>
      {/* CSS keyframes injected once */}
      <style>{`
        @keyframes tour-spin   { to { transform: rotate(360deg); } }
        @keyframes tour-pulse  { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.55; transform: scale(1.12); } }
        @keyframes tour-ring   { 0% { transform: translate(-50%,-50%) scale(0.92); opacity: 0.9; }
                                  100% { transform: translate(-50%,-50%) scale(1.55); opacity: 0; } }
        @keyframes tour-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      `}</style>

      {/* Dark overlay — transparent when spotlight active so target is clickable */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: (spotlight && !navigating) ? 'transparent' : 'rgba(0,0,0,0.50)',
          backdropFilter: (spotlight && !navigating) ? 'none' : 'blur(2px)',
          pointerEvents: 'none',
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
            fill={isWaitingForClick ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.55)"}
            mask="url(#tour-spotlight-mask)"
            style={{ transition: 'fill 0.3s ease' }}
          />
          {/* Static border */}
          <rect
            x={spotlight.left - 1}
            y={spotlight.top - 1}
            width={spotlight.width + 2}
            height={spotlight.height + 2}
            rx={11}
            fill="none"
            stroke={isWaitingForClick ? 'rgba(251,191,36,0.9)' : 'rgba(99,102,241,0.85)'}
            strokeWidth={isWaitingForClick ? 2.5 : 2}
          />
          {/* Animated pulsing border for waitForClick steps */}
          {isWaitingForClick && (
            <rect
              x={spotlight.left - 1}
              y={spotlight.top - 1}
              width={spotlight.width + 2}
              height={spotlight.height + 2}
              rx={11}
              fill="none"
              stroke="rgba(251,191,36,0.5)"
              strokeWidth="6"
              style={{ animation: 'tour-pulse 1.2s ease-in-out infinite' }}
            />
          )}
        </svg>
      )}

      {/* Pulsing "Click here" badge — rendered above the spotlit element */}
      {isWaitingForClick && spotlight && (
        <div
          style={{
            position: 'fixed',
            zIndex: 10001,
            left: spotlight.left + spotlight.width / 2,
            top: spotlight.top - 36,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          {/* Expanding ring */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: '32px', height: '32px',
            borderRadius: '50%',
            border: '2px solid rgba(251,191,36,0.7)',
            animation: 'tour-ring 1.2s ease-out infinite',
          }} />
          {/* Badge */}
          <div style={{
            background: 'rgba(251,191,36,0.95)',
            color: '#1a1a1a',
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '20px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(251,191,36,0.5)',
            animation: 'tour-bounce 1s ease-in-out infinite',
          }}>
            👆 Click here
          </div>
        </div>
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
            animation: 'tour-spin 0.8s linear infinite',
          }} />
          Navigating…
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
            border: isWaitingForClick
              ? '1px solid rgba(251,191,36,0.5)'
              : '1px solid rgba(99,102,241,0.4)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: isWaitingForClick
              ? '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(251,191,36,0.15)'
              : '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Phase progress bars */}
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
          <div style={{ fontSize: '0.65rem', color: isWaitingForClick ? 'rgba(251,191,36,0.9)' : 'rgba(99,102,241,0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
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
            background: isWaitingForClick
              ? 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {currentStep.title}
          </h3>

          {/* Body */}
          <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#94a3b8', margin: '0 0 12px', textAlign: isCentered ? 'center' : 'left' }}>
            {currentStep.body}
          </p>

          {/* waitForClick hint */}
          {isWaitingForClick && (
            <div style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.75rem',
              color: 'rgba(251,191,36,0.9)',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{ animation: 'tour-bounce 1s ease-in-out infinite', display: 'inline-block' }}>👆</span>
              Click the highlighted element to continue
            </div>
          )}

          {/* Step counter */}
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginBottom: '14px', textAlign: isCentered ? 'center' : 'left' }}>
            Step {step + 1} of {STEPS.length}
          </div>

          {/* Buttons — Next is hidden when waitForClick is active */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: isCentered ? 'center' : 'space-between', alignItems: 'center' }}>
            {!isLast && (
              <button
                onClick={() => dismiss(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.28)', fontSize: '0.72rem', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', flexShrink: 0 }}
              >
                Skip tour
              </button>
            )}
            <div style={{ display: 'flex', gap: '8px', marginLeft: (isLast || isWaitingForClick) ? 'auto' : undefined }}>
              {!isFirst && (
                <button
                  onClick={handleBack}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', padding: '8px 14px', cursor: 'pointer' }}
                >
                  ← Back
                </button>
              )}
              {/* Hide Next when waiting for the user to click the real element */}
              {!isWaitingForClick && (
                <button
                  onClick={handleNext}
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, padding: '8px 20px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(99,102,241,0.4)', whiteSpace: 'nowrap' }}
                >
                  {currentStep.nextLabel ?? (isLast ? '🎉 Finish' : 'Next →')}
                </button>
              )}
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

// Call this to reset the tour so it shows on next load from step 0
export function resetTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  sessionStorage.removeItem('idexo_tour_v1_step');
  window.location.reload();
}
