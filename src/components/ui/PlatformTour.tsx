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
    title: 'IDexo Press-ലേക്ക് സ്വാഗതം!',
    body: "നിങ്ങൾ ഇപ്പോൾ IDexo പ്രിന്റിംഗ് പ്ലാറ്റ്‌ഫോമിലാണ്. പെട്ടെന്ന് ആപ്പ് എങ്ങനെ ഉപയോഗിക്കാമെന്ന് ഈ ടൂർ വഴി മനസ്സിലാക്കാം.",
    nextLabel: "സ്റ്റാർട്ട് ചെയ്യാം →",
  },
  {
    targetId: 'nav-overview',
    position: 'right',
    icon: '📊',
    title: 'Overview Dashboard',
    body: 'ഇതാണ് നിങ്ങളുടെ മെയിൻ ഡാഷ്‌ബോർഡ്. ഓർഡറുകൾ, പ്രിന്റിംഗ് സ്റ്റാറ്റസ്, റെവന്യൂ, റീസെന്റ് ആക്റ്റിവിറ്റികൾ ഒക്കെ ഒറ്റനോട്ടത്തിൽ ഇവിടെ കാണാം.',
  },
  {
    targetId: 'nav-clients',
    position: 'right',
    icon: '🏫',
    title: 'Clients (ക്ലയന്റുകൾ)',
    body: 'നിങ്ങൾ കാർഡ് പ്രിന്റ് ചെയ്തു കൊടുക്കുന്ന സ്കൂളുകൾ, കമ്പനികൾ, സ്ഥാപനങ്ങൾ ഒക്കെ ഇവിടെ ആഡ് ചെയ്യാം.',
  },
  {
    targetId: 'nav-templates',
    position: 'right',
    icon: '🎨',
    title: 'Card Templates',
    body: 'ഐഡി കാർഡിന്റെ ഡിസൈൻ ലേഔട്ട് ഇവിടെ ഉണ്ടാക്കാം. ബാക്ക്ഗ്രൗണ്ട് ഇമേജ് അപ്‌ലോഡ് ചെയ്ത് നെയിം, ഫോട്ടോ, QR കോഡ് ഒക്കെ സെറ്റ് ചെയ്യാം.',
  },
  {
    targetId: 'nav-orders',
    position: 'right',
    icon: '📋',
    title: 'Orders',
    body: 'ക്ലയന്റുകൾക്കുള്ള കാർഡ് പ്രിന്റിംഗ് ഓർഡറുകൾ ഇവിടെ ക്രിയേറ്റ് ചെയ്യാം. CSV വഴി ഡാറ്റ ഇമ്പോർട്ട് ചെയ്ത് ജോബ് സ്റ്റാർട്ട് ചെയ്യാം.',
  },
  {
    targetId: 'nav-pdf-jobs',
    position: 'right',
    icon: '🖨️',
    title: 'PDF Production Queue',
    body: 'ഡെസ്ക്ടോപ്പ് ആപ്പിലെ പ്രിന്റ് ജോബുകൾ ഇവിടെ കാണാം. കാർഡുകൾ പ്രിന്റ് ചെയ്യാൻ ready ആയി PDF ആയി ഇവിടെ വരും.',
  },
  {
    targetId: 'nav-marketplace',
    position: 'right',
    icon: '🛒',
    title: 'Template Marketplace',
    body: 'ഡിസൈൻ ചെയ്ത റെഡിമേഡ് ടെംപ്ലേറ്റുകൾ വാങ്ങാനും നിങ്ങളുടെ സ്വന്തം ഡിസൈനുകൾ വിറ്റ് ക്രെഡിറ്റ് നേടാനും സാധിക്കും.',
  },
  {
    targetId: 'tour-credits',
    position: 'right',
    icon: '💳',
    title: 'Print Credits',
    body: 'PDF റെൻഡർ ചെയ്യുമ്പോൾ ക്രെഡിറ്റ്സ് കുറയും. ബാലൻസ് ക്രെഡിറ്റ്സ് ഇവിടെ ചെക്ക് ചെയ്യാം.',
  },
  {
    targetId: 'nav-settings',
    position: 'right',
    icon: '⚙️',
    title: 'Settings',
    body: 'പ്രൊഫൈൽ വിവരങ്ങൾ, ടീം മെമ്പേഴ്സ്, ബില്ലിംഗ്, നോട്ടിഫിക്കേഷനുകൾ ഒക്കെ ഇവിടെ മാനേജ് ചെയ്യാം.',
  },

  // ─── PHASE 2: Create your first Client ─────────────────────────────────────
  {
    icon: '🚀',
    title: "ഇനി നിങ്ങളുടെ ആദ്യത്തെ Client ഉണ്ടാക്കാം!",
    body: "ആദ്യം ഒരു Client-നെ ആഡ് ചെയ്ത്, Template ഉണ്ടാക്കി, Portal Link അയക്കുന്ന വിധം സ്റ്റെപ്പ് ബൈ സ്റ്റെപ്പ് ആയി നോക്കാം. വെറും 3 മിനിറ്റ് മാത്രം!",
    nextLabel: "സ്റ്റാർട്ട് ചെയ്യാം →",
  },
  {
    navigateTo: '/dashboard/clients',
    icon: '🏫',
    title: 'Step 1 — Client Register ചെയ്യുക',
    body: "നിങ്ങൾ കാർഡ് പ്രിന്റ് ചെയ്തു കൊടുക്കുന്ന സ്കൂളോ കമ്പനിയോ ആണ് Client. ഫോം ഓപ്പൺ ചെയ്യാൻ താഴെയുള്ള ബട്ടണിൽ ക്ലിക്ക് ചെയ്യുക.",
    nextLabel: 'കാണിക്കൂ →',
  },
  {
    navigateTo: '/dashboard/clients',
    targetId: 'btn-register-client',
    position: 'bottom',
    icon: '➕',
    title: '"Register Client" ക്ലിക്ക് ചെയ്യുക',
    body: 'രജിസ്ട്രേഷൻ ഫോം തുറക്കാൻ ഹൈലൈറ്റ് ചെയ്ത ബട്ടണിൽ ക്ലിക്ക് ചെയ്യുക.',
    waitForClick: true,
  },
  {
    navigateTo: '/dashboard/clients',
    targetId: 'btn-save-client',
    position: 'bottom',
    icon: '📝',
    title: 'ഡിറ്റെയിൽസ് നൽകി "Save Organization" ക്ലിക്ക് ചെയ്യുക',
    body: 'സ്ഥാപനത്തിന്റെ പേരും കോൺടാക്റ്റ് വിവരങ്ങളും നൽകിയ ശേഷം "Save Organization" ബട്ടൺ ക്ലിക്ക് ചെയ്യുക.',
    waitForClick: true,
  },
  {
    navigateTo: '/dashboard/clients',
    icon: '✅',
    title: 'Client സക്സസ്ഫുളായി Save ആയി!',
    body: "സൂപ്പർ! ഇനി കാർഡ് ലേഔട്ട് ഡിസൈൻ ചെയ്യാൻ Templates പേജിലേക്ക് പോകാം.",
    nextLabel: 'അടുത്തത്: Template ഡിസൈൻ ചെയ്യാം →',
  },

  // ─── PHASE 3: Create your first Template ────────────────────────────────────
  {
    navigateTo: '/dashboard/templates',
    icon: '🎨',
    title: 'Step 2 — Template ക്രിയേറ്റ് ചെയ്യുക',
    body: "ഐഡി കാർഡിന്റെ ഡിസൈൻ, ഫോണ്ടുകൾ, ഫീൽഡുകൾ ഒക്കെ സെറ്റ് ചെയ്യുന്നതാണ് Template. പോർട്ടൽ ലിങ്ക് ഉണ്ടാക്കുന്നതിന് മുൻപ് ഒരു ടെംപ്ലേറ്റ് വേണം.",
    nextLabel: 'കാണിക്കൂ →',
  },
  {
    navigateTo: '/dashboard/templates',
    targetId: 'btn-create-template',
    position: 'bottom',
    icon: '➕',
    title: '"+ Create Template" ക്ലിക്ക് ചെയ്യുക',
    body: 'ടെംപ്ലേറ്റ് ഡിസൈനർ ഫോം ഓപ്പൺ ചെയ്യാൻ ഹൈലൈറ്റ് ചെയ്ത ബട്ടണിൽ ക്ലിക്ക് ചെയ്യുക.',
    waitForClick: true,
  },
  {
    navigateTo: '/dashboard/templates',
    targetId: 'template-name',
    position: 'bottom',
    icon: '✏️',
    title: '1. Template Name നൽകുക',
    body: 'നിങ്ങളുടെ ടെംപ്ലേറ്റിന് അനുയോജ്യമായ ഒരു പേര് (ഉദാഹരണത്തിന് "School ID 2026") ഇവിടെ നൽകുക.',
  },
  {
    navigateTo: '/dashboard/templates',
    targetId: 'client-assignment-section',
    position: 'bottom',
    icon: '🏫',
    title: '2. Client-ലേക്ക് Assign ചെയ്യുക',
    body: 'ഈ ടെംപ്ലേറ്റ് ഏത് Client-നാണ് ഉപയോഗിക്കേണ്ടതെന്ന് ഡ്രോപ്‌ഡൗണിൽ നിന്ന് സെലക്ട് ചെയ്യുക.',
  },
  {
    navigateTo: '/dashboard/templates',
    targetId: 'template-image-section',
    position: 'bottom',
    icon: '🖼️',
    title: '3. Card Background Image അപ്‌ലോഡ് ചെയ്യുക',
    body: 'ഐഡി കാർഡിന്റെ ഫ്രണ്ട് / ബാക്ക് ബാക്ക്ഗ്രൗണ്ട് ഇമേജ് (PNG, SVG, PDF) ഇവിടെ അപ്‌ലോഡ് ചെയ്യുക.',
  },
  {
    navigateTo: '/dashboard/templates',
    targetId: 'btn-add-field-mapping',
    position: 'top',
    icon: '📍',
    title: '4. Fields ആഡ് ചെയ്ത് മാപ്പ് ചെയ്യുക',
    body: 'നെയിം, ഫോട്ടോ, റോൾ നമ്പർ തുടങ്ങിയ വിവരങ്ങൾ കാർഡിൽ ചേർക്കാനും ഡ്രാഗ് ചെയ്ത് പൊസിഷൻ സെറ്റ് ചെയ്യാനും ഹൈലൈറ്റ് ചെയ്ത ബട്ടണിൽ ക്ലിക്ക് ചെയ്യുക.',
    waitForClick: true,
  },
  {
    navigateTo: '/dashboard/templates',
    targetId: 'btn-save-template',
    position: 'top',
    icon: '🛠️',
    title: '5. "Save Template" ക്ലിക്ക് ചെയ്യുക',
    body: 'എല്ലാ വിവരങ്ങളും ഫീൽഡുകളും സെറ്റ് ചെയ്ത ശേഷം "Save Template" ക്ലിക്ക് ചെയ്ത് സേവ് ചെയ്യുക.',
    waitForClick: true,
  },
  {
    navigateTo: '/dashboard/templates',
    icon: '🎨',
    title: 'Template Save ആയി!',
    body: "ഗ്രേറ്റ്! ടെംപ്ലേറ്റ് തയ്യാറായി. ഇനി പോർട്ടൽ ലിങ്ക് ജനറേറ്റ് ചെയ്ത് ഷെയർ ചെയ്യാനായി Clients പേജിലേക്ക് പോകാം.",
    nextLabel: 'അടുത്തത്: Portal Link ഷെയർ ചെയ്യാം →',
  },

  // ─── PHASE 4: Share the Client Portal Link ───────────────────────────────────
  {
    icon: '🔗',
    title: 'Step 3 — Client Portal ഷെയർ ചെയ്യുക',
    body: "ഓരോ ക്ലയന്റിനും ഒരു സെക്യൂർ പോർട്ടൽ ലിങ്ക് ഉണ്ടാകും. ഇത് സ്ഥാപനത്തിന്റെ ഹെഡിന് അയച്ചു കൊടുത്താൽ അവർക്ക് തന്നെ മെമ്പേഴ്സിന്റെ ഫോട്ടോകളും വിവരങ്ങളും അപ്‌ലോഡ് ചെയ്യാം.",
    nextLabel: 'കാണിക്കൂ →',
  },
  {
    navigateTo: '/dashboard/clients',
    targetId: 'btn-open-client',
    position: 'bottom',
    icon: '📂',
    title: 'Client ഡയറക്ടറി ഓപ്പൺ ചെയ്യുക',
    body: 'പോർട്ടൽ ലിങ്ക് എടുക്കാൻ നിങ്ങളുടെ Client കാർഡിൽ ക്ലിക്ക് ചെയ്യുക.',
    waitForClick: true,
  },
  {
    targetId: 'btn-portal-tab',
    position: 'bottom',
    icon: '🔗',
    title: '"Client Portal Links" ടാബിൽ ക്ലിക്ക് ചെയ്യുക',
    body: 'പോർട്ടൽ ലിങ്ക് സെക്ഷനിലേക്ക് മാറാൻ ഹൈലൈറ്റ് ചെയ്ത ടാബിൽ ക്ലിക്ക് ചെയ്യുക.',
    waitForClick: true,
  },
  {
    targetId: 'btn-generate-links',
    position: 'top',
    icon: '⚡',
    title: 'Template സെലക്ട് ചെയ്ത് "Generate Links" ക്ലിക്ക് ചെയ്യുക',
    body: 'നിങ്ങൾ ഉണ്ടാക്കിയ ടെംപ്ലേറ്റ് സെലക്ട് ചെയ്ത ശേഷം "Generate Links" ബട്ടൺ ക്ലിക്ക് ചെയ്യുക.',
    waitForClick: true,
  },
  {
    icon: '📩',
    title: 'Link കോപ്പി ചെയ്ത് Share ചെയ്യാം!',
    body: 'പോർട്ടൽ ലിങ്ക് ജനറേറ്റ് ആയിക്കഴിഞ്ഞു! ഈ Link copy ചെയ്ത് ക്ലയന്റിനോ ആളുകൾക്കോ share ചെയ്യുക. എൻറോൾ ലിങ്ക് വഴി ആളുകൾ വിവരങ്ങൾ സബ്മിറ്റ് ചെയ്യുമ്പോൾ, ആ ഡാറ്റ മുഴുവൻ Client ഡയറക്ടറിയിലെ "Cardholders" ടാബിൽ സ്വയം പ്രത്യക്ഷപ്പെടും. അവിടെ നിന്ന് നിങ്ങൾക്ക് നേരിട്ട് PDF Compile ചെയ്യാവുന്നതാണ്!',
    nextLabel: 'മനസ്സിലായി, Tour അവസാനിപ്പിക്കാം 🎉',
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

  // Phase labels in Malayalam
  const PHASE_BOUNDARIES = [0, 9, 13, 21, 26]; // Overview, Client, Template, Portal, Done
  const PHASE_NAMES = ['അവലോകനം', 'ക്ലയന്റ്', 'ടെംപ്ലേറ്റ്', 'പോർട്ടൽ', 'പൂർത്തിയായി'];
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

  // Continuous real-time target tracking — spotlight & badge lock onto button as it moves/scrolls
  useEffect(() => {
    if (!visible) return;

    if (currentStep.targetId) {
      const el = document.getElementById(currentStep.targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    let animFrameId: number;
    const trackTarget = () => {
      computePositions(currentStep);
      animFrameId = requestAnimationFrame(trackTarget);
    };

    trackTarget();

    const handleScrollOrResize = () => computePositions(currentStep);
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [step, visible, currentStep, computePositions]);

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

  // ── waitForClick: attach click listener with form validation & success verification ──
  useEffect(() => {
    if (!visible || !currentStep.waitForClick || !currentStep.targetId) return;
    const el = document.getElementById(currentStep.targetId);
    if (!el) return;

    const formEl = el.closest('form');

    const handleClick = () => {
      // 1. Validate HTML form fields if button is inside a form
      if (formEl && typeof formEl.checkValidity === 'function') {
        if (!formEl.checkValidity()) {
          // Form fields incomplete or invalid — trigger native browser popups & DO NOT advance tour!
          formEl.reportValidity();
          return;
        }
      }

      // 2. For save buttons, verify that the save actually succeeds before advancing
      const isSaveStep = currentStep.targetId === 'btn-save-client' || currentStep.targetId === 'btn-save-template';

      if (isSaveStep) {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          const targetStillExists = document.getElementById(currentStep.targetId!);

          // When client/template creation succeeds, the form modal closes and the save button unmounts
          if (!targetStillExists) {
            clearInterval(checkInterval);
            if (!isLast) goToStep(step + 1);
            else dismiss(true);
          } else if (attempts >= 50) {
            // Timeout (5 seconds) — save failed or errored out; keep tour on current step
            clearInterval(checkInterval);
          }
        }, 100);
      } else {
        // Navigation, tab, or generate buttons advance after short delay
        setTimeout(() => {
          if (!isLast) goToStep(step + 1);
          else dismiss(true);
        }, 150);
      }
    };

    // Use capture phase (true) so event listeners run even if stopPropagation is used
    el.addEventListener('click', handleClick, true);
    if (formEl) {
      formEl.addEventListener('submit', handleClick, true);
    }

    return () => {
      el.removeEventListener('click', handleClick, true);
      if (formEl) {
        formEl.removeEventListener('submit', handleClick, true);
      }
    };
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
      {/* CSS keyframes injected once — simple & minimalist */}
      <style>{`
        @keyframes tour-spin       { to { transform: rotate(360deg); } }
        @keyframes tour-fade-in    { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tour-pulse-soft { 0%,100% { opacity: 0.7; } 50% { opacity: 0.25; } }
      `}</style>

      {/* Dark overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: (spotlight && !navigating) ? 'transparent' : 'rgba(0,0,0,0.50)',
          backdropFilter: (spotlight && !navigating) ? 'none' : 'blur(2px)',
          pointerEvents: 'none',
          transition: 'background 0.2s ease',
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
            style={{ transition: 'fill 0.2s ease' }}
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
          {/* Subtle soft pulse for interactive steps */}
          {isWaitingForClick && (
            <rect
              x={spotlight.left - 1}
              y={spotlight.top - 1}
              width={spotlight.width + 2}
              height={spotlight.height + 2}
              rx={11}
              fill="none"
              stroke="rgba(251,191,36,0.5)"
              strokeWidth="4"
              style={{ animation: 'tour-pulse-soft 2s ease-in-out infinite' }}
            />
          )}
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
            animation: 'tour-spin 0.8s linear infinite',
          }} />
          നാവിഗേറ്റ് ചെയ്യുന്നു…
        </div>
      )}

      {/* Tooltip card */}
      {!navigating && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            zIndex: 10000,
            width: isWaitingForClick ? '300px' : '330px',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            ...(isCentered
              ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
              : tooltipPos
              ? { top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px` }
              : { display: 'none' }),
            transition: 'top 0.15s ease-out, left 0.15s ease-out',
            animation: 'tour-fade-in 0.18s ease-out',
            background: '#1e293b',
            border: isWaitingForClick ? '1px solid #f59e0b' : '1px solid #475569',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
          }}
        >
          {/* Phase label */}
          <div style={{ fontSize: '0.65rem', color: isWaitingForClick ? '#fbbf24' : '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            {PHASE_NAMES[currentPhase]}
          </div>

          {/* Icon */}
          <div style={{ fontSize: isCentered ? '2.2rem' : '1.5rem', marginBottom: '8px', textAlign: isCentered ? 'center' : 'left', lineHeight: 1 }}>
            {currentStep.icon}
          </div>

          {/* Title */}
          <h3 style={{
            fontSize: isCentered ? '1.15rem' : '0.95rem',
            fontWeight: 600,
            margin: '0 0 6px',
            textAlign: isCentered ? 'center' : 'left',
            color: isWaitingForClick ? '#fef08a' : '#ffffff',
          }}>
            {currentStep.title}
          </h3>

          {/* Body */}
          <p style={{ fontSize: '0.82rem', lineHeight: 1.5, color: '#cbd5e1', margin: '0 0 12px', textAlign: isCentered ? 'center' : 'left' }}>
            {currentStep.body}
          </p>

          {/* Step counter */}
          <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '14px', textAlign: isCentered ? 'center' : 'left' }}>
            {step + 1} / {STEPS.length} ഘട്ടം
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: isCentered ? 'center' : 'space-between', alignItems: 'center' }}>
            {!isLast && (
              <button
                onClick={() => dismiss(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer', padding: '4px 0', textDecoration: 'underline', flexShrink: 0 }}
              >
                ടൂർ ഒഴിവാക്കുക
              </button>
            )}
            <div style={{ display: 'flex', gap: '8px', marginLeft: (isLast || isWaitingForClick) ? 'auto' : undefined }}>
              {!isFirst && (
                <button
                  onClick={handleBack}
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.78rem', padding: '6px 12px', cursor: 'pointer' }}
                >
                  ← പുറകോട്ട്
                </button>
              )}
              {!isWaitingForClick && (
                <button
                  onClick={handleNext}
                  style={{ background: '#4f46e5', border: 'none', borderRadius: '6px', color: '#ffffff', fontSize: '0.78rem', fontWeight: 600, padding: '6px 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {currentStep.nextLabel ?? (isLast ? '🎉 പൂർത്തിയാക്കുക' : 'അടുത്തത് →')}
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
          title="ടൂർ അടയ്ക്കുക"
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
