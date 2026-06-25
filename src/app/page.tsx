import React from 'react';
import Link from 'next/link';
import {
  Printer, LayoutGrid, ArrowRight, CircleCheckBig, Apple,
  Monitor, Terminal, Download, Activity, Settings, MessageSquare,
  RefreshCw, FileSpreadsheet, CircleX, ClipboardList, MonitorPlay
} from 'lucide-react';
import TimelineContainer from './components/TimelineContainer';
import FaqAccordion from './components/FaqAccordion';

export const metadata = {
  title: "IDexo — ID Card Production Software for Printing Presses",
  description: "Automate your entire ID card workflow from client data collection to print-ready PDF. Stop manually renaming photos or copy-pasting into CorelDRAW."
};

export default function LandingPage() {
  return (
    <div className="saas-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .saas-root {
          background-color: #102650;
          color: #f3f4f6;
          min-height: 100vh;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        .hero-section {
          padding: 120px 24px 80px 24px;
        }

        /* Tech Grid Background */
        .saas-grid {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%);
          z-index: 1;
          pointer-events: none;
        }

        /* Ambient Glow Blobs */
        .blob-primary {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, rgba(16, 38, 80, 0) 70%);
          top: -150px;
          left: 5%;
          z-index: 1;
          pointer-events: none;
          animation: float-slow 15s infinite ease-in-out alternate;
        }

        .blob-secondary {
          position: absolute;
          width: 700px;
          height: 700px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.015) 0%, rgba(16, 38, 80, 0) 75%);
          top: 25%;
          right: 5%;
          z-index: 1;
          pointer-events: none;
          animation: float-slow 18s infinite ease-in-out alternate-reverse;
        }

        @keyframes float-slow {
          0% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.02); }
          100% { transform: translateY(0px) scale(1); }
        }

        /* Typography & Layout Constraints */
        .saas-display {
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.03em;
          color: #ffffff;
        }
        .saas-display span {
          color: #ffffff;
          border-bottom: 3px solid rgba(255, 255, 255, 0.3);
        }

        .saas-headline-lg {
          font-size: clamp(1.8rem, 3.5vw, 2.6rem);
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.02em;
          color: #ffffff;
        }

        .saas-headline-md {
          font-size: 20px;
          font-weight: 600;
          line-height: 1.35;
          color: #ffffff;
          letter-spacing: -0.015em;
        }

        .saas-body-lg {
          font-size: 19px;
          font-weight: 400;
          line-height: 1.65;
          color: #cbd5e1;
        }

        .saas-body-md {
          font-size: 15px;
          font-weight: 400;
          line-height: 1.6;
          color: #9ca3af;
        }

        /* Fixed Navigation Header */
        .saas-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: rgba(16, 38, 80, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.3s ease;
          height: 76px;
        }

        .saas-header-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 100%;
        }

        .saas-nav {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .saas-nav-link {
          color: #9ca3af;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        }
        .saas-nav-link:hover {
          color: #ffffff;
        }

        /* Glassmorphic Cards & Layout Grids */
        .glass-card {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        /* Action Buttons */
        .glow-btn-primary {
          background: #ffffff;
          color: #102650;
          border-radius: 8px;
          border: 1px solid #ffffff;
          font-weight: 600;
          box-shadow: 0 4px 20px rgba(255, 255, 255, 0.1);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }
        .glow-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.9);
        }

        .glow-btn-secondary {
          background: rgba(255, 255, 255, 0.03);
          color: #ffffff;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          font-weight: 500;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }
        .glow-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }

        .neon-tag {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 99px;
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .neon-tag-red {
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.3);
          background: rgba(248, 113, 113, 0.05);
        }

        .neon-tag-green {
          color: #34d399;
          border-color: rgba(52, 211, 153, 0.3);
          background: rgba(52, 211, 153, 0.05);
        }

        /* Demo Video Play Button hover */
        .group:hover .play-btn {
          transform: scale(1.1) !important;
          box-shadow: 0 0 50px rgba(255,255,255,0.5) !important;
          background: #ffffff !important;
        }

        .group:hover img {
          transform: scale(1.03);
        }

        /* Tech Separators */
        .tech-line {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.08) 20%, rgba(255, 255, 255, 0.08) 80%, transparent);
        }

        .feature-icon-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.15);
          width: 52px;
          height: 52px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          margin-bottom: 24px;
        }

        /* Custom Section Layouts */
        .hero-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 64px;
          align-items: center;
        }

        .problem-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: flex-start;
        }

        .feature-showcase-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
          padding: 80px 0;
        }

        .feature-showcase-grid.reverse {
          direction: rtl;
        }
        .feature-showcase-grid.reverse > * {
          direction: ltr;
        }

        .roi-numbers-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          margin-bottom: 64px;
        }

        .roi-comparison-grid {
          max-width: 1000px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }

        .testimonials-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        .download-grid {
          max-width: 1000px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 48px;
        }

        /* Mockup Image Container Styling */
        .mockup-image-frame {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          width: 100%;
          height: auto;
          display: block;
        }

        /* Comparison Lists */
        .compare-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .compare-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        /* OS Download cards */
        .os-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 32px 24px;
          text-align: center;
          transition: all 0.3s ease;
        }

        .os-card:hover {
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-4px);
        }

        .os-icon-wrapper {
          margin-bottom: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .os-download-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          background: #ffffff;
          color: #102650;
          border: none;
          border-radius: 6px;
          padding: 12px 20px;
          font-weight: 600;
          font-size: 0.9rem;
          text-align: center;
          cursor: pointer;
          transition: background 0.2s;
          text-decoration: none;
        }
        .os-download-btn:hover {
          background: rgba(255, 255, 255, 0.9);
        }

        /* Download Steps Row */
        .download-steps-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .download-step-card {
          text-align: center;
        }

        .step-number {
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #ffffff;
          margin: 0 auto 16px auto;
          font-size: 0.95rem;
        }

        /* Mobile Bottom Sticky Bar */
        .mobile-bottom-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 999;
          background: rgba(16, 38, 80, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 20px;
          display: none;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.4);
        }

        /* Responsive Breakpoints */
        @media (max-width: 992px) {
          .hero-section {
            padding: 4px 16px 40px 16px !important;
          }
          .hero-grid {
            grid-template-columns: 1fr;
            gap: 48px;
            text-align: center;
          }
          .hero-grid > div {
            align-items: center;
            justify-content: center;
          }
          .problem-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .feature-showcase-grid {
            grid-template-columns: 1fr;
            gap: 48px;
            padding: 40px 0;
          }
          .feature-showcase-grid.reverse {
            direction: ltr;
          }
          .roi-numbers-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .roi-comparison-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .testimonials-grid {
            grid-template-columns: 1fr;
          }
          .download-grid {
            grid-template-columns: 1fr;
            max-width: 400px;
          }
          .download-steps-row {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          
          .saas-header {
            height: auto !important;
            padding: 6px 0 !important;
            position: relative !important;
          }
          .saas-header-inner {
            flex-direction: column;
            gap: 6px !important;
            padding: 0 16px;
          }
          .saas-nav {
            gap: 16px;
            flex-wrap: wrap;
            justify-content: center;
          }

          /* Show Sticky Footer on Mobile */
          .mobile-bottom-bar {
            display: flex;
          }
          
          /* Extra bottom padding to avoid overlapping the sticky footer */
          footer {
            padding-bottom: 120px !important;
          }
        }
      `}} />

      <div className="saas-grid" />
      <div className="blob-primary" />
      <div className="blob-secondary" />

      {/* Navigation Header */}
      <header className="saas-header">
        <div className="saas-header-inner">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{
              width: '38px',
              height: '38px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px'
            }}>
              <img
                src="/logo.png"
                alt="IDexo Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'brightness(0) invert(1)'
                }}
              />
            </div>
            <span style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.75px', color: '#ffffff' }}>
              IDexo
            </span>
          </Link>

          <nav className="saas-nav">
            <a href="#howitworks" className="saas-nav-link">How It Works</a>
            <a href="#features" className="saas-nav-link">Features</a>
            <a href="#faq" className="saas-nav-link">FAQ</a>
            <a
              href="#download"
              className="glow-btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} /> Download Free
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section" style={{ position: 'relative', zIndex: 10 }}>
        <div className="hero-grid">
          
          {/* Left Column: Copy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="neon-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <MonitorPlay size={14} /> ID Card Automation Console
            </div>

            <h1 className="saas-display">
              Stop Building <span>ID Cards</span> One by One
            </h1>

            <p className="saas-body-lg">
              IDexo automates your entire ID card workflow — from client data collection to print-ready PDF — right from your desktop. A 500-card job that used to take two days now takes a morning.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
              <a
                href="#download"
                className="glow-btn-primary"
                style={{ padding: '16px 32px', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
              >
                Download IDexo Free <Download size={16} />
              </a>
              <a
                href="/samples/production_sample.pdf"
                download="production_sample.pdf"
                className="glow-btn-secondary"
                style={{ padding: '16px 28px', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
              >
                Get Imposed PDF Sample <ArrowRight size={16} />
              </a>
            </div>

            <div style={{ display: 'flex', gap: '20px', color: '#9ca3af', fontSize: '0.85rem', flexWrap: 'wrap', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CircleCheckBig size={14} style={{ color: '#34d399' }} />
                <span>Free to download</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CircleCheckBig size={14} style={{ color: '#34d399' }} />
                <span>Automate customer data intake</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CircleCheckBig size={14} style={{ color: '#34d399' }} />
                <span>Zero server timeout PDF compiles</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Mockup */}
          <div>
            <img
              src="/hero_dashboard.png"
              alt="IDexo ID Card Production Dashboard"
              className="mockup-image-frame"
            />
          </div>

        </div>
      </section>

      <div className="tech-line" />

      {/* Used By Client Strip */}
      <section style={{ padding: '40px 24px', position: 'relative', zIndex: 10, background: 'rgba(255, 255, 255, 0.01)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Used by presses serving —
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
            {['Schools', 'Colleges', 'Corporates', 'Hospitals', 'Events', 'Government'].map((client, idx) => (
              <span key={idx} style={{
                fontSize: '0.9rem',
                fontWeight: '700',
                letterSpacing: '-0.3px',
                color: '#64748b',
                textTransform: 'uppercase'
              }}>
                {client}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="tech-line" />

      {/* How It Works Section */}
      <section id="howitworks" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 80px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="neon-tag" style={{ alignSelf: 'center' }}>The Workflow</div>
            <h2 className="saas-headline-lg">
              From client data to print-ready PDF — without the manual work
            </h2>
            <p className="saas-body-md">
              IDexo replaces the entire WhatsApp-Excel-CorelDRAW chain with one desktop app. Here's how a job moves through the system.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '32px' }}>
            
            <div className="glass-card" style={{ padding: '24px' }}>
              <div className="feature-icon-box" style={{ width: '40px', height: '40px', marginBottom: '16px' }}>
                <ClipboardList size={20} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                1. Share Form Link
              </h3>
              <p className="saas-body-md" style={{ fontSize: '0.85rem' }}>
                Send your client a secure link. Their employees fill in their own details and upload photos.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <div className="feature-icon-box" style={{ width: '40px', height: '40px', marginBottom: '16px' }}>
                <Settings size={20} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                2. Cards Auto-Generate
              </h3>
              <p className="saas-body-md" style={{ fontSize: '0.85rem' }}>
                IDexo pulls the data into your template and generates every card instantly.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <div className="feature-icon-box" style={{ width: '40px', height: '40px', marginBottom: '16px' }}>
                <LayoutGrid size={20} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                3. Production Grid Ready
              </h3>
              <p className="saas-body-md" style={{ fontSize: '0.85rem' }}>
                Cards are auto-arranged on print sheets with correct spacing and crop marks.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
              <div className="feature-icon-box" style={{ width: '40px', height: '40px', marginBottom: '16px' }}>
                <Printer size={20} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                4. Export PDF & Print
              </h3>
              <p className="saas-body-md" style={{ fontSize: '0.85rem' }}>
                Generate your print-ready PDF in seconds directly from the application.
              </p>
            </div>

          </div>

        </div>
      </section>

      <div className="tech-line" />

      {/* Problem / Pain Section */}
      <section id="problem" style={{ padding: '100px 24px', position: 'relative', zIndex: 10, background: 'rgba(255, 255, 255, 0.01)' }}>
        <div className="problem-grid">
          
          {/* Left Column: Pain Points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="neon-tag neon-tag-red">The Current Reality</div>
            <h2 className="saas-headline-lg">
              Your ID card workflow is costing you more than you think
            </h2>
            <p className="saas-body-lg" style={{ fontSize: '17px', color: '#cbd5e1' }}>
              Ask any printing press owner how they handle ID card jobs, and the answer is almost always the same. A lot of WhatsApp messages, a lot of Excel gymnastics, and a lot of late nights trying to match photos to names before the client calls again.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ color: '#ffffff', marginTop: '2px' }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h4 style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.95rem', marginBottom: '4px' }}>
                    Photos arrive on WhatsApp, one by one
                  </h4>
                  <p className="saas-body-md" style={{ fontSize: '0.85rem' }}>
                    You spend hours downloading, renaming, and sorting photos before you can open any design tool. One missing photo and the whole job stalls.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ color: '#ffffff', marginTop: '2px' }}>
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h4 style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.95rem', marginBottom: '4px' }}>
                    Excel sheets full of errors you didn't make
                  </h4>
                  <p className="saas-body-md" style={{ fontSize: '0.85rem' }}>
                    Name misspellings. Missing employee IDs. Departments that don't match. You catch the mistakes halfway through production.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ color: '#ffffff', marginTop: '2px' }}>
                  <RefreshCw size={20} />
                </div>
                <div>
                  <h4 style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.95rem', marginBottom: '4px' }}>
                    Copy-paste from Excel into CorelDRAW — for every single card
                  </h4>
                  <p className="saas-body-md" style={{ fontSize: '0.85rem' }}>
                    500 employee IDs means 500 manual copy-pastes. One typo and you're reprinting at your own cost.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ color: '#ffffff', marginTop: '2px' }}>
                  <Activity size={20} />
                </div>
                <div>
                  <h4 style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.95rem', marginBottom: '4px' }}>
                    A 2-hour job turns into a 2-day job
                  </h4>
                  <p className="saas-body-md" style={{ fontSize: '0.85rem' }}>
                    Between chasing data, fixing errors, arranging cards for print, and generating PDFs — a 200-card job eats your entire week.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Visual Mockup */}
          <div>
            <img
              src="/problem_chaos.png"
              alt="Data and Production Chaos Visual Representation"
              className="mockup-image-frame"
            />
          </div>

        </div>
      </section>

      <div className="tech-line" />

      {/* Feature 01 — Let your clients do the data entry */}
      <section id="features" style={{ padding: '60px 24px', position: 'relative', zIndex: 10 }}>
        <div className="feature-showcase-grid">
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="neon-tag">Feature 01 — Data Collection</div>
            <h2 className="saas-headline-lg">
              Let your clients do the data entry. You just print.
            </h2>
            <p className="saas-body-lg" style={{ fontSize: '16px' }}>
              Instead of chasing photos over WhatsApp and cleaning up broken Excel files, you send your client a secure form link from inside IDexo. Their employees or students fill it themselves — name, department, ID number, and photo upload. Everything lands in your dashboard, clean and organized.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>No more hunting for missing photos two days before the deadline</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Photos upload directly — no renaming, no folder sorting</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>See real-time submission progress — know exactly how complete the job is</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Works on any phone browser. No app download needed for your clients.</span>
              </li>
            </ul>
          </div>

          <div>
            <img
              src="/feature_data_collection.png"
              alt="Client Intake Form and Data Collection Portal"
              className="mockup-image-frame"
            />
          </div>

        </div>
      </section>

      {/* Feature 02 — Design the card once */}
      <section style={{ padding: '60px 24px', position: 'relative', zIndex: 10, background: 'rgba(255, 255, 255, 0.01)' }}>
        <div className="feature-showcase-grid reverse">
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="neon-tag">Feature 02 — Template Automation</div>
            <h2 className="saas-headline-lg">
              Design the card once. Generate 500 in seconds.
            </h2>
            <p className="saas-body-lg" style={{ fontSize: '16px' }}>
              Build your client's ID card template inside IDexo — set the layout, colors, logo, and field positions. After that, you never touch the design again. Every name, photo, QR code, barcode, and department fills in automatically for every person in the batch.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Auto-fill names, photos, employee IDs, departments, barcodes, and QR codes</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Reuse templates across jobs — same client, new batch, done in minutes</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Front and back card design supported</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>No CorelDRAW. No Photoshop. No copy-paste. Ever again.</span>
              </li>
            </ul>
          </div>

          <div>
            <img
              src="/feature_template_designer.png"
              alt="Template Designer Canvas"
              className="mockup-image-frame"
            />
          </div>

        </div>
      </section>

      {/* Feature 03 — Print-ready sheets, automatically arranged */}
      <section style={{ padding: '60px 24px', position: 'relative', zIndex: 10 }}>
        <div className="feature-showcase-grid">
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="neon-tag">Feature 03 — Production Grid</div>
            <h2 className="saas-headline-lg">
              Print-ready sheets, automatically arranged. Zero manual layout.
            </h2>
            <p className="saas-body-lg" style={{ fontSize: '16px' }}>
              Every card is placed on the production sheet automatically — perfectly spaced, properly aligned, with crop marks exactly where they need to be. What used to take an hour of arrangement in CorelDRAW is done before you finish your tea.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Cards auto-arrange to fit A3, A4, or custom sheet sizes</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Set bleed, margin, and card spacing once — applied to every job</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>No manual positioning. No alignment headaches.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Works for 50 cards or 5,000 — same effort either way</span>
              </li>
            </ul>
          </div>

          <div>
            <img
              src="/feature_production_grid.png"
              alt="Auto arranged Production Sheet Grid"
              className="mockup-image-frame"
            />
          </div>

        </div>
      </section>

      {/* Feature 04 — Every job. Every client. One app. */}
      <section style={{ padding: '60px 24px', position: 'relative', zIndex: 10, background: 'rgba(255, 255, 255, 0.01)' }}>
        <div className="feature-showcase-grid reverse">
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="neon-tag">Feature 04 — Bulk PDF & Multi-Client</div>
            <h2 className="saas-headline-lg">
              Every job. Every client. One app.
            </h2>
            <p className="saas-body-lg" style={{ fontSize: '16px' }}>
              Generate production-ready PDFs for an entire job in one click — directly from your desktop. Manage school batches, corporate jobs, and event credentials from a single dashboard without switching between folders, files, or tools.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Bulk PDF generation — entire batch in seconds, not hours</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Duplex back-to-back alignment templates fully integrated</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Manage schools, colleges, companies, hospitals, and events under one roof</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                <CircleCheckBig size={16} style={{ color: '#ffffff' }} />
                <span>Fewer mistakes. Fewer reprints. Lower cost per job.</span>
              </li>
            </ul>
          </div>

          <div>
            <img
              src="/feature_press_console.png"
              alt="Press Console Dashboard Interface"
              className="mockup-image-frame"
            />
          </div>

        </div>
      </section>

      <div className="tech-line" />

      {/* ROI Section */}
      <section id="roi" style={{ padding: '100px 24px', position: 'relative', zIndex: 10, background: 'rgba(255, 255, 255, 0.01)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 80px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="neon-tag" style={{ alignSelf: 'center' }}>The Numbers</div>
            <h2 className="saas-headline-lg">
              What you get back when the manual work disappears
            </h2>
            <p className="saas-body-md">
              Most printing presses don't realize how much time the manual workflow is burning — not just in production hours, but in reprints, delayed deliveries, and jobs you had to turn down because capacity was full.
            </p>
          </div>

          <div className="roi-numbers-grid">
            <div className="glass-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: '800', color: '#ffffff', lineHeight: 1.1, marginBottom: '12px' }}>80%</div>
              <p className="saas-body-md" style={{ color: '#cbd5e1' }}>
                Reduction in production time per ID card job, from data collection to PDF export
              </p>
            </div>

            <div className="glass-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: '800', color: '#ffffff', lineHeight: 1.1, marginBottom: '12px' }}>0</div>
              <p className="saas-body-md" style={{ color: '#cbd5e1' }}>
                Copy-paste errors. Cards generate directly from submitted data — no human in the middle
              </p>
            </div>

            <div className="glass-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: '800', color: '#ffffff', lineHeight: 1.1, marginBottom: '12px' }}>3×</div>
              <p className="saas-body-md" style={{ color: '#cbd5e1' }}>
                More ID card jobs you can take on with the same team, same machine, same working hours
              </p>
            </div>
          </div>

          <div className="roi-comparison-grid">
            
            <div className="glass-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <h3 className="saas-headline-md" style={{ color: '#ef4444', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CircleX size={20} /> Without IDexo
              </h3>
              <ul className="compare-list">
                <li className="compare-item">
                  <span style={{ color: '#ef4444' }}>•</span>
                  <span style={{ color: '#cbd5e1' }}>2–3 days chasing photos and data over WhatsApp and email</span>
                </li>
                <li className="compare-item">
                  <span style={{ color: '#ef4444' }}>•</span>
                  <span style={{ color: '#cbd5e1' }}>Hours cleaning Excel sheets that arrive wrong every time</span>
                </li>
                <li className="compare-item">
                  <span style={{ color: '#ef4444' }}>•</span>
                  <span style={{ color: '#cbd5e1' }}>Manual copy-paste into CorelDRAW for every single card</span>
                </li>
                <li className="compare-item">
                  <span style={{ color: '#ef4444' }}>•</span>
                  <span style={{ color: '#cbd5e1' }}>Reprints from errors that slipped through after hours of manual work</span>
                </li>
                <li className="compare-item">
                  <span style={{ color: '#ef4444' }}>•</span>
                  <span style={{ color: '#cbd5e1' }}>Stressed team, delayed deliveries, clients calling for updates</span>
                </li>
              </ul>
            </div>

            <div className="glass-card" style={{ borderLeft: '4px solid #34d399', background: 'rgba(52, 211, 153, 0.02)' }}>
              <h3 className="saas-headline-md" style={{ color: '#34d399', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CircleCheckBig size={20} /> With IDexo
              </h3>
              <ul className="compare-list">
                <li className="compare-item">
                  <span style={{ color: '#34d399' }}>•</span>
                  <span style={{ color: '#ffffff', fontWeight: '500' }}>Clients submit their own data — form link generated in 30 seconds</span>
                </li>
                <li className="compare-item">
                  <span style={{ color: '#34d399' }}>•</span>
                  <span style={{ color: '#ffffff', fontWeight: '500' }}>Data arrives clean and structured into your dashboard</span>
                </li>
                <li className="compare-item">
                  <span style={{ color: '#34d399' }}>•</span>
                  <span style={{ color: '#ffffff', fontWeight: '500' }}>All 500 cards generate automatically from your saved template</span>
                </li>
                <li className="compare-item">
                  <span style={{ color: '#34d399' }}>•</span>
                  <span style={{ color: '#ffffff', fontWeight: '500' }}>Production sheets arranged and PDF ready in under a minute</span>
                </li>
                <li className="compare-item">
                  <span style={{ color: '#34d399' }}>•</span>
                  <span style={{ color: '#ffffff', fontWeight: '500' }}>Your team focuses on printing and delivering — not admin work</span>
                </li>
              </ul>
            </div>

          </div>

        </div>
      </section>

      <div className="tech-line" />

      {/* Testimonials Section */}
      <section id="testimonials" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 80px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="neon-tag" style={{ alignSelf: 'center' }}>From the Press Floor</div>
            <h2 className="saas-headline-lg">What happens when your workflow finally works</h2>
          </div>

          <div className="testimonials-grid">
            
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
                  {[...Array(5)].map((_, c) => (
                    <span key={c} style={{ color: '#fbbf24', fontSize: '1.2rem' }}>★</span>
                  ))}
                </div>
                <p className="saas-body-md" style={{ fontSize: '0.95rem', fontStyle: 'italic', lineHeight: '1.7', color: '#e5e7eb', marginBottom: '24px' }}>
                  "We used to spend two full days on every school ID card job — chasing photos, cleaning spreadsheets, doing everything in CorelDRAW. Now the same job takes half a morning. I don't know why we waited this long."
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#102650' }}>
                  <Printer size={18} />
                </div>
                <div>
                  <h4 style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.95rem' }}>Sreedharan P.</h4>
                  <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Owner, Printcraft Kerala</span>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
                  {[...Array(5)].map((_, c) => (
                    <span key={c} style={{ color: '#fbbf24', fontSize: '1.2rem' }}>★</span>
                  ))}
                </div>
                <p className="saas-body-md" style={{ fontSize: '0.95rem', fontStyle: 'italic', lineHeight: '1.7', color: '#e5e7eb', marginBottom: '24px' }}>
                  "The production grid alone paid for itself in the first week. We used to manually arrange every card on the print sheet in CorelDRAW. Now it just happens. I can't explain to people how much time this saves until they see it."
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#ffffff' }}>
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h4 style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.95rem' }}>Anitha R.</h4>
                  <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Manager, Logos Print Studio</span>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', marginBottom: '16px' }}>
                <MessageSquare size={20} />
              </div>
              <h4 style={{ color: '#ffffff', fontWeight: '600', fontSize: '1rem', marginBottom: '8px' }}>Your review could be here</h4>
              <p className="saas-body-md" style={{ fontSize: '0.8rem' }}>Early users get featured in our commercial press directory.</p>
            </div>

          </div>

        </div>
      </section>

      <div className="tech-line" />

      {/* FAQ Accordion Section */}
      <section id="faq" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="neon-tag" style={{ marginBottom: '16px' }}>FAQ</div>
            <h2 className="saas-headline-lg">Frequently Asked Questions</h2>
          </div>

          <FaqAccordion />

        </div>
      </section>

      <div className="tech-line" />

      {/* Download Section */}
      <section id="download" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 80px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="neon-tag" style={{ alignSelf: 'center' }}>Download IDexo</div>
            <h2 className="saas-headline-lg">Free to download. Free to set up.</h2>
            <p className="saas-body-md">
              Install IDexo on your press computer, create your first client, and run your first job. Get started producing print-ready cards immediately.
            </p>
          </div>

          <div className="download-grid">
            
            <div className="os-card">
              <div className="os-icon-wrapper">
                <Monitor size={36} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffffff', marginBottom: '4px' }}>Windows</h3>
              <p className="saas-body-md" style={{ fontSize: '0.8rem', marginBottom: '24px' }}>Windows 10 / 11 • 64-bit</p>
              <a href="#" className="os-download-btn">
                <Download size={16} /> Download .exe
              </a>
            </div>

            <div className="os-card">
              <div className="os-icon-wrapper">
                <Apple size={36} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffffff', marginBottom: '4px' }}>macOS</h3>
              <p className="saas-body-md" style={{ fontSize: '0.8rem', marginBottom: '24px' }}>macOS 12 Monterey and above</p>
              <a href="#" className="os-download-btn">
                <Download size={16} /> Download .dmg
              </a>
            </div>

            <div className="os-card">
              <div className="os-icon-wrapper">
                <Terminal size={36} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ffffff', marginBottom: '4px' }}>Linux</h3>
              <p className="saas-body-md" style={{ fontSize: '0.8rem', marginBottom: '24px' }}>Ubuntu 20.04+ • Debian-based</p>
              <a href="#" className="os-download-btn">
                <Download size={16} /> Download .AppImage
              </a>
            </div>

          </div>

          <div className="glass-card" style={{ maxWidth: '900px', margin: '0 auto', padding: '40px' }}>
            <div className="download-steps-row">
              
              <div className="download-step-card">
                <div className="step-number">1</div>
                <h4 style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.85rem', marginBottom: '6px' }}>Install</h4>
                <p className="saas-body-md" style={{ fontSize: '0.75rem' }}>Download & install IDexo on your computer</p>
              </div>

              <div className="download-step-card">
                <div className="step-number">2</div>
                <h4 style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.85rem', marginBottom: '6px' }}>Register</h4>
                <p className="saas-body-md" style={{ fontSize: '0.75rem' }}>Create your free account inside the app</p>
              </div>

              <div className="download-step-card">
                <div className="step-number">3</div>
                <h4 style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.85rem', marginBottom: '6px' }}>Setup</h4>
                <p className="saas-body-md" style={{ fontSize: '0.75rem' }}>Add a client and build your first template</p>
              </div>

              <div className="download-step-card">
                <div className="step-number">4</div>
                <h4 style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.85rem', marginBottom: '6px' }}>Print</h4>
                <p className="saas-body-md" style={{ fontSize: '0.75rem' }}>Start producing and exporting print-ready layouts</p>
              </div>

            </div>
          </div>

        </div>
      </section>

      <div className="tech-line" />

      {/* Final CTA Section */}
      <section style={{ padding: '120px 24px', position: 'relative', zIndex: 10, textAlign: 'center', background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255, 255, 255, 0.02), transparent 70%)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
          <div className="neon-tag">Get Started Today</div>
          <h2 className="saas-display">Your next ID card job should take hours, not days</h2>
          <p className="saas-body-lg" style={{ maxWidth: '650px' }}>
            Download IDexo free, set up your first client, and see the difference immediately. Start generating print-ready ID cards with zero layout delay.
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '16px' }}>
            <a
              href="#download"
              className="glow-btn-primary"
              style={{ padding: '16px 32px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              Download for Windows <Download size={16} />
            </a>
            <a
              href="#download"
              className="glow-btn-secondary"
              style={{ padding: '16px 32px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              Download for macOS <Apple size={16} />
            </a>
            <a
              href="#download"
              className="glow-btn-secondary"
              style={{ padding: '16px 32px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              Download for Linux <Terminal size={16} />
            </a>
          </div>

          <p className="saas-body-md" style={{ fontSize: '0.8rem', opacity: .6, marginTop: '8px' }}>
            Free to download · No subscriptions or contract commitments
          </p>
        </div>
      </section>

      <div className="tech-line" />

      {/* End-to-End Operation Lifecycle Section (Relocated to bottom, just above demo & footer) */}
      <TimelineContainer />

      <div className="tech-line" />

      {/* Demo Video Section */}
      <section id="demo" style={{
        padding: '100px 24px',
        position: 'relative',
        zIndex: 10,
        background: 'rgba(12, 28, 60, 0.4)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <span className="neon-tag neon-tag-green" style={{ marginBottom: '16px' }}>Video Tour</span>
          <h2 className="saas-display" style={{ marginBottom: '24px', fontSize: '2.8rem' }}>
            See IDexo in <span>3 Minutes</span>
          </h2>
          <p className="saas-body-lg" style={{ maxWidth: '640px', margin: '0 auto 48px auto' }}>
            Watch how easy it is to collect data, design template cards, and compile print-ready sheets.
          </p>

          <div 
            style={{
              position: 'relative',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
              background: '#070a13',
              aspectRatio: '16/9',
              maxWidth: '850px',
              margin: '0 auto 48px auto',
              cursor: 'pointer'
            }}
            className="group"
          >
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              background: 'radial-gradient(circle, rgba(16, 38, 80, 0.4) 0%, rgba(7, 10, 19, 0.8) 100%)',
              transition: 'background 0.3s ease'
            }}>
              <div 
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  color: '#102650',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 40px rgba(255,255,255,0.3)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                className="play-btn"
              >
                <MonitorPlay size={36} fill="#102650" style={{ marginLeft: '4px' }} />
              </div>
            </div>
            <img
              src="/hero_dashboard.png"
              alt="IDexo Product Demo Video Thumbnail"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: .6,
                transition: 'transform 0.5s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <a
              href="#download"
              className="glow-btn-primary"
              style={{ padding: '16px 40px', fontSize: '1.1rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '10px' }}
            >
              <Download size={20} /> Get Started Free Now
            </a>
            <p className="saas-body-md" style={{ fontSize: '0.85rem' }}>
              Instant download · No registration required to test
            </p>
          </div>
        </div>
      </section>

      <div className="tech-line" />

      {/* Footer */}
      <footer style={{ padding: '80px 24px 48px 24px', backgroundColor: '#0c1b3c', borderTop: '1px solid rgba(255, 255, 255, 0.05)', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '48px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            paddingBottom: '48px',
            marginBottom: '32px'
          }}>
            
            <div style={{ maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '5px'
                }}>
                  <img
                    src="/logo.png"
                    alt="IDexo Logo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      filter: 'brightness(0) invert(1)'
                    }}
                  />
                </div>
                <span style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.5px', color: '#ffffff' }}>
                  IDexo
                </span>
              </div>
              <p className="saas-body-md" style={{ fontSize: '0.875rem' }}>
                High-performance hybrid PDF engine and database collection portal for printing presses.
              </p>
              <span className="saas-body-md" style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                © 2025 IDexo. Built for printing presses.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '64px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffffff' }}>
                  Product
                </span>
                <a href="#howitworks" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem' }}>How It Works</a>
                <a href="#features" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem' }}>Features</a>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffffff' }}>
                  Resources
                </span>
                <a href="#faq" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem' }}>FAQ</a>
                <a href="#download" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem' }}>Download</a>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', fontSize: '0.875rem', color: '#9ca3af' }}>
            <span>© {new Date().getFullYear()} IDexo Inc. All rights reserved.</span>
            <div style={{ display: 'flex', gap: '24px' }}>
              <a href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>Privacy Policy</a>
              <a href="#" style={{ color: '#9ca3af', textDecoration: 'none' }}>Terms of Service</a>
            </div>
          </div>

        </div>
      </footer>

      {/* Mobile Sticky bottom navigation bar */}
      <div className="mobile-bottom-bar">
        <a 
          href="#demo" 
          className="glow-btn-secondary" 
          style={{ 
            flex: 1, 
            padding: '12px 16px', 
            fontSize: '0.9rem', 
            textDecoration: 'none', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '8px',
            margin: 0
          }}
        >
          <MonitorPlay size={16} /> Watch Demo
        </a>
        <a 
          href="#download" 
          className="glow-btn-primary" 
          style={{ 
            flex: 1, 
            padding: '12px 16px', 
            fontSize: '0.9rem', 
            textDecoration: 'none', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '8px',
            margin: 0
          }}
        >
          <Download size={16} /> Download App
        </a>
      </div>
    </div>
  );
}