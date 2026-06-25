'use client';

import React, { useState } from 'react';
import { CheckCircle, Printer, Shield, Cpu, Database } from 'lucide-react';
import ScrollStackRaw, { ScrollStackItem } from './ScrollStack';
const ScrollStack = ScrollStackRaw as any;

interface StepImage {
  src: string;
  alt: string;
  label: string;
  badge: string;
  styleType: 'phone' | 'browser' | 'crop' | 'grid' | 'invoice' | 'desktop';
}

interface Step {
  title: string;
  subtitle: string;
  phase: string;
  description: string;
  instructions: string[];
  mockType: string;
  images: StepImage[];
}

const nodePositions = [
  { x: 30, y: 20 },
  { x: 70, y: 60 },
  { x: 30, y: 100 },
  { x: 70, y: 140 },
  { x: 30, y: 180 },
  { x: 70, y: 220 },
  { x: 30, y: 260 },
  { x: 70, y: 300 },
  { x: 30, y: 340 },
  { x: 70, y: 380 },
  { x: 30, y: 420 },
  { x: 70, y: 460 },
  { x: 50, y: 500 }
];

const curvedPathD = "M 30 20 C 60 20, 40 60, 70 60 C 40 60, 60 100, 30 100 C 60 100, 40 140, 70 140 C 40 140, 60 180, 30 180 C 60 180, 40 220, 70 220 C 40 220, 60 260, 30 260 C 60 260, 40 300, 70 300 C 40 300, 60 340, 30 340 C 60 340, 40 380, 70 380 C 40 380, 60 420, 30 420 C 60 420, 40 460, 70 460 C 40 460, 60 500, 50 500";

const steps: Step[] = [
  {
    title: "Register Your Account",
    subtitle: "01",
    phase: "Onboarding",
    description: "Create your print shop profile on the IDexo platform to set up your workspace and unlock layouts.",
    instructions: [
      "Register with your business email to set up a secure workspace.",
      "Instantly activate access to professional coordinate mappings.",
      "Select from preset CR80 PVC template configurations to begin."
    ],
    mockType: "download",
    images: [
      { src: "/feature_press_console.png", alt: "Client Registration screen", label: "Press Account Profile", badge: "v2.4.1", styleType: "desktop" },
      { src: "/hero_dashboard.png", alt: "Cloud Connectivity Sync", label: "Cloud Workspace Sync", badge: "Connected", styleType: "browser" }
    ]
  },
  {
    title: "Configure Workspace Settings",
    subtitle: "02",
    phase: "Setup",
    description: "Set up default margins, pricing per card, tax rates (GST), and currency formatting for automatic invoicing.",
    instructions: [
      "Define default layout margins and safe-crop offsets.",
      "Configure tax parameters and currency formatting.",
      "Set base print pricing for invoice auto-generation."
    ],
    mockType: "signup",
    images: [
      { src: "/feature_press_console.png", alt: "Workspace Settings Form", label: "Merchant Onboarding Portal", badge: "SECURE SSL", styleType: "browser" },
      { src: "/hero_dashboard.png", alt: "Plan selector", label: "Select Subscription Plan", badge: "BASIC / PRO", styleType: "browser" }
    ]
  },
  {
    title: "Press Console Login",
    subtitle: "03",
    phase: "Authentication",
    description: "Sign in to the central IDexo Press Dashboard. Authenticate your session and access the centralized command hub to control all client templates, databases, and print queues.",
    instructions: [
      "Multi-factor authentication (MFA) supported for operator safety.",
      "JWT-powered secure session tracking.",
      "Role-Based Access Control (RBAC) for Owners, Operators, and Designers."
    ],
    mockType: "login",
    images: [
      { src: "/feature_press_console.png", alt: "Dashboard Login", label: "Operator Login Page", badge: "AUTH0 SECURE", styleType: "browser" }
    ]
  },
  {
    title: "Onboard Client Accounts",
    subtitle: "04",
    phase: "Client Onboarding",
    description: "Register your customer organizations—such as schools, corporate offices, NGOs, or event agencies—in your dashboard to segment template designs, billing rates, and databases.",
    instructions: [
      "Define client classification (School, Corporation, Government).",
      "Assign contact emails for secure portal handshakes.",
      "Manage separate card templates and print queues per client."
    ],
    mockType: "onboard",
    images: [
      { src: "/feature_press_console.png", alt: "Clients Table", label: "Client Directory", badge: "12 ACTIVE", styleType: "browser" },
      { src: "/hero_dashboard.png", alt: "Add Client Form", label: "Register New Entity", badge: "Client Form", styleType: "browser" }
    ]
  },
  {
    title: "Configure Template Settings File",
    subtitle: "05",
    phase: "Design Studio",
    description: "Configure layout coordinates (photos, text, barcodes) in a single settings file. Calibrate margins, bleed, gutters, and card spacing in seconds to reuse across jobs.",
    instructions: [
      "Define standard 300 DPI layout settings in a single config file.",
      "Calibrate card offsets, margins, and bleed dimensions.",
      "Configure dynamic parameters like custom fonts and barcodes."
    ],
    mockType: "template",
    images: [
      { src: "/feature_template_designer.png", alt: "Layout Config Editor", label: "Production Settings Mapper", badge: "Template Config", styleType: "browser" },
      { src: "/feature_template_designer.png", alt: "Template Preview", label: "Design Blueprint Grid", badge: "Vector Canvas", styleType: "crop" }
    ]
  },
  {
    title: "Generate Client Intake Link",
    subtitle: "06",
    phase: "Sharing",
    description: "Generate a secure, tokenized intake link. This shifts the entire data collection and photo intake workload to your client's administrative team, removing print shop labor.",
    instructions: [
      "Generate encrypted URL tokens containing secure keys.",
      "Configure portal share access limits and active statuses.",
      "Email or WhatsApp the link directly to the school principal or HR manager."
    ],
    mockType: "share",
    images: [
      { src: "/feature_data_collection.png", alt: "Share Link Generation Modal", label: "Intake Link Manager", badge: "PORTAL TOKEN", styleType: "browser" }
    ]
  },
  {
    title: "Delegate Department Intake",
    subtitle: "07",
    phase: "Delegate Intake",
    description: "Allow the client administration to subdivide portal access. They can generate unique sub-links for individual class teachers or department heads to input rosters independently.",
    instructions: [
      "Admin generates separate sub-tokens for Grade 10, Grade 11, Admin, etc.",
      "Enables secure data isolation—teachers only see and edit their own classes.",
      "Prevents concurrent data-overwrite conflicts during roster uploads."
    ],
    mockType: "departments",
    images: [
      { src: "/feature_data_collection.png", alt: "Department Links List", label: "Department Dashboard", badge: "8 DEPARTMENTS", styleType: "browser" }
    ]
  },
  {
    title: "Self-Serve Roster Intake",
    subtitle: "08",
    phase: "Data Intake",
    description: "Client operators upload roster CSVs and bulk drag-and-drop headshots directly into the portal. The system auto-matches photos to roster records.",
    instructions: [
      "Excel headers automatically map to active template fields.",
      "ZIP extractor parses image names matching student roll numbers/IDs.",
      "Webcam support enables individual on-site captures directly."
    ],
    mockType: "upload",
    images: [
      { src: "/feature_data_collection.png", alt: "Bulk CSV Onboarding", label: "Excel Data Exporter", badge: "Roster Upload", styleType: "browser" },
      { src: "/feature_data_collection.png", alt: "ZIP drag-and-drop", label: "ZIP Image Batch Import", badge: "Photo Archive", styleType: "browser" }
    ]
  },
  {
    title: "Self-Serve Cropping & QA",
    subtitle: "09",
    phase: "Quality Assurance",
    description: "Clients review spelling, correct errors, and crop profile photos themselves. They complete the QA checklist before submitting the job to you.",
    instructions: [
      "Smart cropper overlays guide boxes for ISO compliance.",
      "Inline grid allows quick corrections of names and blood groups.",
      "Flags missing cardholder fields before approval submission."
    ],
    mockType: "verify",
    images: [
      { src: "/feature_data_collection.png", alt: "Cropping tool", label: "Face Alignment Tool", badge: "ISO standard", styleType: "crop" },
      { src: "/feature_data_collection.png", alt: "Mobile uploader crop", label: "Mobile Photo Verification", badge: "Live Camera", styleType: "phone" }
    ]
  },
  {
    title: "Sync to Print Queue",
    subtitle: "10",
    phase: "Data Sync",
    description: "Once approved by the client, cardholder details automatically lock and synchronize to your Press Console as 'Ready to Compile', stopping any further client-side modifications.",
    instructions: [
      "Instant PostgreSQL webhooks push status transitions.",
      "Real-time list view shows card status as 'Ready to Compile'.",
      "Locks the data fields on the client portal to prevent post-print edits."
    ],
    mockType: "sync",
    images: [
      { src: "/feature_press_console.png", alt: "Press Dashboard Synchronized list", label: "Synchronized Print List", badge: "128 CARDHOLDERS", styleType: "desktop" }
    ]
  },
  {
    title: "Generate Customer Proof Sheets",
    subtitle: "11",
    phase: "Verification Proof",
    description: "Export a watermarked Approval Proof PDF (multi-card grid sheet) for the client's final sign-off, alongside downloading an Excel database backup for offline records.",
    instructions: [
      "Generates watermarked PDFs (4/8 cards per page) with signature sheets.",
      "Permits client representatives to verify spelling and photos offline.",
      "Allows exporting data to Excel backups for offline records."
    ],
    mockType: "verification_pdf",
    images: [
      { src: "/feature_production_grid.png", alt: "Watermarked PDF Proof", label: "Watermarked Proof sheet", badge: "PROOF ONLY", styleType: "crop" },
      { src: "/feature_press_console.png", alt: "Excel Export Dialog", label: "Excel Data Archive", badge: "backup.xlsx", styleType: "browser" }
    ]
  },
  {
    title: "Compile Duplex Layout Sheets",
    subtitle: "12",
    phase: "Print Production",
    description: "Trigger sheet compilation. The engine automatically compiles cardholder assets and imposes them on A3 grids with registration marks, bleed guides, and mirrored back-sides.",
    instructions: [
      "Select sheet size (A3 Portrait/Landscape) and margins.",
      "Applies fold-line grid algorithm to mirror backs and fronts.",
      "Embeds CMYK color profiles, registration targets, and bleed guides."
    ],
    mockType: "production",
    images: [
      { src: "/feature_production_grid.png", alt: "A3 Production Grid Layout", label: "A3 Duplex Layout", badge: "300 DPI CMYK", styleType: "grid" },
      { src: "/feature_production_grid.png", alt: "Crop Marks Closeup", label: "Print crop marks and bleed", badge: "3mm Bleed", styleType: "crop" }
    ]
  },
  {
    title: "Calculate Yield & Invoice",
    subtitle: "13",
    phase: "Billing & Invoicing",
    description: "Automatically calculate billing details based on card counts, price-per-card, and tax percentages, then generate print-ready PDF invoices and sync bookkeeping.",
    instructions: [
      "Auto-generates billing invoices from order quantities.",
      "Tracks payment state (UNPAID, PARTIAL, PAID) and payment method.",
      "Exports invoice PDFs and saves them directly to your system."
    ],
    mockType: "invoice",
    images: [
      { src: "/feature_press_console.png", alt: "Invoice Details Panel", label: "Billing Invoice", badge: "PAID", styleType: "invoice" }
    ]
  }
];

export default function TimelineContainer() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="pipeline" className="timeline-section" style={{ position: 'relative' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 60px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="neon-tag" style={{ alignSelf: 'center' }}>Live Production Pipeline</div>
          <h2 className="saas-headline-lg">End-to-End Operational Lifecycle</h2>
          <p className="saas-body-md">
            From the initial system installation to physical production and invoicing. Scroll down to see each phase in action.
          </p>
        </div>

        <div className="timeline-layout-grid">

          {/* Left Column: Sticky Timeline Curved Track */}
          <div style={{
            position: 'sticky',
            top: '80px',
            height: 'calc(100vh - 100px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '24px',
            padding: '24px 16px',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            zIndex: 20
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
              Pipeline Progress
            </span>

            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              {/* Curved SVG Timeline */}
              <svg width="120" height="420" viewBox="0 0 100 520" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="curve-glow-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#e2e8f0" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                  </linearGradient>
                  <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Background Path */}
                <path
                  d={curvedPathD}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.04)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                {/* Glowing Animated Path */}
                <path
                  d={curvedPathD}
                  fill="none"
                  stroke="url(#curve-glow-grad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="1200"
                  strokeDashoffset={1200 - (1200 * (activeStep / 12))}
                  style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.16, 1, 0.3, 1)', filter: 'url(#glow-filter)' }}
                />

                {/* Step Nodes */}
                {nodePositions.map((pos, idx) => {
                  const isActive = activeStep === idx;
                  const isPassed = activeStep >= idx;
                  return (
                    <g
                      key={idx}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const element = document.getElementById(`step-card-${idx}`);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                    >
                      {isActive && (
                        <circle cx={pos.x} cy={pos.y} r="14" fill="#ffffff" opacity="0.25" className="animate-pulse" />
                      )}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isActive ? "9" : "6"}
                        fill={isPassed ? "#ffffff" : "#0c1c3c"}
                        stroke={isActive ? "#ffffff" : isPassed ? "#ffffff" : "rgba(255, 255, 255, 0.15)"}
                        strokeWidth={isActive ? "2.5" : "1.5"}
                        style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
                      />
                      {/* Interactive tooltip / number label */}
                      <text
                        x={pos.x + (idx % 2 === 0 ? 16 : -16)}
                        y={pos.y + 3}
                        fill={isActive ? "#ffffff" : isPassed ? "#cbd5e1" : "#6b7280"}
                        fontSize={isActive ? "10" : "8"}
                        fontWeight="700"
                        fontFamily="monospace"
                        textAnchor={idx % 2 === 0 ? "start" : "end"}
                        style={{ transition: 'all 0.3s ease', userSelect: 'none' }}
                      >
                        {(idx + 1).toString().padStart(2, '0')}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Quick Status indicator */}
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                ACTIVE PHASE
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ffffff', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {steps[activeStep]?.phase}
              </div>
            </div>
          </div>

          {/* Right Column: Step Detail Cards */}
          <ScrollStack
            useWindowScroll={false}
            onActiveStepChange={setActiveStep}
            className="timeline-cards-scroll"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '40px',
              height: 'calc(100vh)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '24px',
              paddingLeft: '24px',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
            }}
            itemDistance={80}
            itemScale={0.02}
            itemStackDistance={25}
            stackPosition="15%"
            scaleEndPosition="5%"
            baseScale={0.9}
          >
            {steps.map((step, idx) => (
              <ScrollStackItem
                key={idx}
                id={`step-card-${idx}`}
                itemClassName={`step-card-anchor glass-card ${activeStep === idx ? 'pricing-card-recommended' : ''}`}
                style={{
                  scrollMarginTop: '160px',
                  position: 'relative',
                  transition: 'border-color 0.4s ease, background-color 0.4s ease, box-shadow 0.4s ease',
                  borderWidth: '1px',
                  borderColor: activeStep === idx ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.06)',
                  background: activeStep === idx ? '#142a54' : '#0c1c3c',
                  padding: '40px'
                }}
              >
                {/* Glowing Accent for Active Card */}
                {activeStep === idx && (
                  <div className="popular-neon-badge" style={{ right: '40px', background: '#ffffff', color: '#102650' }}>Active Step</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      display: 'block',
                      marginBottom: '6px'
                    }}>
                      {step.phase} &bull; Step {idx + 1} of 13
                    </span>
                    <h3 className="saas-headline-md" style={{ fontSize: '1.8rem', fontWeight: '700' }}>
                      {step.title}
                    </h3>
                  </div>

                  {/* Step Indicator Badge */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    padding: '6px 14px',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontWeight: '700',
                    fontSize: '0.9rem'
                  }}>
                    PHASE_{step.subtitle}
                  </div>
                </div>

                <p className="saas-body-md" style={{ fontSize: '1.05rem', color: '#d1d5db', lineHeight: '1.6' }}>
                  {step.description}
                </p>

                {/* Instructions Grid */}
                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    Operational Guidelines
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {step.instructions.map((inst, instIdx) => (
                      <li key={instIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.95rem', color: '#9ca3af' }}>
                        <CheckCircle size={16} color="#10b981" style={{ marginTop: '3px', flexShrink: 0 }} />
                        <span>{inst}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Multi-Image Mockup Row */}
                <div className="mockup-wrapper">
                  {step.images.map((img, imgIdx) => (
                    <div key={imgIdx} className="mockup-card">
                      <span className="mockup-badge">{img.badge}</span>

                      {/* Render specific mockup layout type */}
                      {img.styleType === 'browser' && (
                        <div className="mockup-browser" style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="mockup-browser-header">
                            <div className="browser-dots">
                              <div className="mockup-browser-dot" style={{ backgroundColor: '#ef4444' }} />
                              <div className="mockup-browser-dot" style={{ backgroundColor: '#f59e0b' }} />
                              <div className="mockup-browser-dot" style={{ backgroundColor: '#10b981' }} />
                            </div>
                            <div className="mockup-browser-url">idexo.io/{step.mockType}</div>
                          </div>
                          <div style={{ padding: '8px', position: 'relative', overflow: 'hidden', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={img.src} alt={img.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', opacity: 0.8 }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(3,7,18,0.8), transparent 70%)' }} />
                          </div>
                        </div>
                      )}

                      {img.styleType === 'phone' && (
                        <div className="mockup-phone">
                          <div className="mockup-phone-notch" />
                          <div style={{ position: 'relative', overflow: 'hidden', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
                            <img src={img.src} alt={img.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                            <div className="crop-overlay">
                              <div className="crop-bracket crop-tl" />
                              <div className="crop-bracket crop-tr" />
                              <div className="crop-bracket crop-bl" />
                              <div className="crop-bracket crop-br" />
                            </div>
                          </div>
                        </div>
                      )}

                      {img.styleType === 'crop' && (
                        <div style={{ position: 'relative', overflow: 'hidden', height: '164px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <img src={img.src} alt={img.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                          <div className="crop-overlay">
                            <div className="crop-bracket crop-tl" />
                            <div className="crop-bracket crop-tr" />
                            <div className="crop-bracket crop-bl" />
                            <div className="crop-bracket crop-br" />
                          </div>
                          <div style={{ position: 'absolute', bottom: '8px', left: '0', right: '0', textAlign: 'center', fontSize: '0.65rem', color: '#10b981', fontWeight: '700', letterSpacing: '0.05em' }}>
                            X: 245px | Y: 180px
                          </div>
                        </div>
                      )}

                      {img.styleType === 'grid' && (
                        <div className="grid-preview-container" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="grid-fold-line" />
                          <img src={img.src} alt={img.alt} style={{ width: '100%', height: '70px', objectFit: 'contain', opacity: 0.6 }} />
                          <img src={img.src} alt={img.alt} style={{ width: '100%', height: '70px', objectFit: 'contain', opacity: 0.6 }} />
                          <img src={img.src} alt={img.alt} style={{ width: '100%', height: '70px', objectFit: 'contain', opacity: 0.6 }} />
                          <img src={img.src} alt={img.alt} style={{ width: '100%', height: '70px', objectFit: 'contain', opacity: 0.6 }} />
                        </div>
                      )}

                      {img.styleType === 'desktop' && (
                        <div className="mockup-browser" style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="mockup-browser-header" style={{ justifyContent: 'flex-start' }}>
                            <div className="browser-dots">
                              <div className="mockup-browser-dot" style={{ backgroundColor: '#ef4444' }} />
                              <div className="mockup-browser-dot" style={{ backgroundColor: '#f59e0b' }} />
                              <div className="mockup-browser-dot" style={{ backgroundColor: '#10b981' }} />
                            </div>
                            <span style={{ fontSize: '0.6rem', color: '#9ca3af', fontFamily: 'monospace', marginLeft: '12px' }}>IDexo Compiling Engine</span>
                          </div>
                          <div style={{ display: 'flex', height: '140px', background: '#070a13' }}>
                            <div style={{ width: '30px', background: '#0b0f19', borderRight: '1px solid rgba(255,255,255,0.03)' }} />
                            <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#ffffff', fontFamily: 'monospace' }}>
                                <span>$ idexo --compile</span>
                                <span>[ACTIVE]</span>
                              </div>
                              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                                <img src={img.src} alt={img.alt} style={{ width: '36px', height: '50px', objectFit: 'cover', borderRadius: '2px', opacity: 0.6 }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', width: '80%' }} />
                                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', width: '50%' }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {img.styleType === 'invoice' && (
                        <div style={{ position: 'relative', overflow: 'hidden', height: '164px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <img src={img.src} alt={img.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.15 }} />
                          <div className="invoice-overlay">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#9ca3af' }}>INVOICE #INV-4929</span>
                              <span style={{ fontSize: '0.6rem', background: '#10b981', color: '#ffffff', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>PAID</span>
                            </div>
                            <div style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#9ca3af' }}>
                                <span>Quantity:</span>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>128 Cards</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#9ca3af' }}>
                                <span>Subtotal:</span>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>$256.00</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#9ca3af' }}>
                                <span>Tax (GST 18%):</span>
                                <span style={{ color: '#fff', fontWeight: 'bold' }}>$46.08</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
                              <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: '700' }}>Total Paid:</span>
                              <span style={{ fontSize: '0.7rem', color: '#ffffff', fontWeight: '700' }}>$302.08</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mockup-label">{img.label}</div>
                    </div>
                  ))}
                </div>
              </ScrollStackItem>
            ))}
          </ScrollStack>

        </div>
      </div>
    </section>
  );
}
