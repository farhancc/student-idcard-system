'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Printer, LayoutGrid, ArrowRight, CircleCheckBig, Apple,
  Monitor, Terminal, Download, Activity, Settings, MessageSquare,
  RefreshCw, FileSpreadsheet, CircleX, ClipboardList, MonitorPlay,
  Zap, Sparkles, ShieldCheck, Layers, Cpu, CheckCircle2, ChevronRight,
  FileCode2, UserCheck, Sliders, Smartphone, Check, Award, CreditCard,
  Ticket, IdCard, Mail, Stamp, FileCheck
} from 'lucide-react';
import FaqAccordion from './components/FaqAccordion';

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'intake' | 'designer' | 'grid' | 'billing'>('intake');

  return (
    <div className="idexo-landing-root">
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bg-dark: #070d1e;
          --bg-card: rgba(15, 23, 42, 0.7);
          --border-glass: rgba(255, 255, 255, 0.08);
          --border-glow: rgba(99, 102, 241, 0.35);
          --accent-indigo: #6366f1;
          --accent-cyan: #06b6d4;
          --accent-emerald: #10b981;
          --text-muted: #94a3b8;
        }

        .idexo-landing-root {
          background-color: var(--bg-dark);
          color: #f8fafc;
          min-height: 100vh;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* Hero Background Effects */
        .tech-grid-bg {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(99, 102, 241, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, 0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, #000 70%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, #000 70%, transparent 100%);
          z-index: 1;
          pointer-events: none;
        }

        .ambient-glow-1 {
          position: absolute;
          width: 700px;
          height: 700px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(7, 13, 30, 0) 70%);
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1;
          pointer-events: none;
          filter: blur(60px);
        }

        .ambient-glow-2 {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(7, 13, 30, 0) 70%);
          top: 35%;
          right: -100px;
          z-index: 1;
          pointer-events: none;
          filter: blur(80px);
        }

        /* Navigation Header */
        .idexo-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: rgba(7, 13, 30, 0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-glass);
          height: 76px;
        }

        .idexo-header-inner {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 100%;
        }

        .nav-link {
          color: var(--text-muted);
          text-decoration: none;
          font-weight: 500;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        }
        .nav-link:hover {
          color: #ffffff;
        }

        /* Typography & Headings */
        .gradient-text {
          background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #818cf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .display-hero {
          font-size: clamp(2.4rem, 5.5vw, 4.2rem);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .headline-section {
          font-size: clamp(1.8rem, 3.8vw, 2.8rem);
          font-weight: 800;
          line-height: 1.15;
          letter-spacing: -0.025em;
        }

        /* Glassmorphism Components */
        .glass-panel {
          background: var(--bg-card);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--border-glass);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-panel:hover {
          border-color: rgba(99, 102, 241, 0.3);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.1);
        }

        /* Badges */
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 99px;
          color: #a5b4fc;
          font-size: 0.825rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        /* Buttons */
        .btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #ffffff;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          font-weight: 600;
          padding: 14px 28px;
          font-size: 0.975rem;
          box-shadow: 0 10px 25px rgba(79, 70, 229, 0.4);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 35px rgba(79, 70, 229, 0.5), 0 0 20px rgba(99, 102, 241, 0.4);
          background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.04);
          color: #f8fafc;
          border-radius: 12px;
          border: 1px solid var(--border-glass);
          font-weight: 500;
          padding: 14px 26px;
          font-size: 0.975rem;
          transition: all 0.3s ease;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        /* Mockup Frame */
        .hero-mockup-frame {
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15);
          width: 100%;
          height: auto;
          display: block;
        }

        /* Tech Separator Line */
        .divider-line {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.08) 20%, rgba(255, 255, 255, 0.08) 80%, transparent);
        }

        /* Feature Tab Button */
        .tab-btn {
          padding: 14px 24px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.25s ease;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tab-btn.active {
          background: rgba(99, 102, 241, 0.15);
          border-color: rgba(99, 102, 241, 0.4);
          color: #ffffff;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.2);
        }

        /* VDP Card Badge Grid */
        .vdp-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 16px;
          max-width: 1240px;
          margin: 0 auto;
        }

        .vdp-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-glass);
          border-radius: 16px;
          padding: 20px 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          transition: all 0.3s ease;
        }
        .vdp-card:hover {
          border-color: rgba(99, 102, 241, 0.4);
          background: rgba(99, 102, 241, 0.08);
          transform: translateY(-4px);
        }

        /* Responsive Grids */
        .hero-layout {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 60px;
          align-items: center;
          padding: 130px 24px 80px 24px;
        }

        .stats-grid {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }

        .features-grid {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        .vs-comparison-grid {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }

        .os-downloads-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
        }

        @media (max-width: 1024px) {
          .vdp-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .hero-layout {
            grid-template-columns: 1fr;
            text-align: center;
            padding-top: 100px;
          }
          .hero-layout > div {
            align-items: center;
            justify-content: center;
          }
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .features-grid {
            grid-template-columns: 1fr;
          }
          .vs-comparison-grid {
            grid-template-columns: 1fr;
          }
          .os-downloads-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .vdp-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}} />

      <div className="tech-grid-bg" />
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      {/* Navigation Header */}
      <header className="idexo-header">
        <div className="idexo-header-inner">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '12px',
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
            <span style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px', color: '#ffffff' }}>
              IDexo<span style={{ color: '#818cf8', fontSize: '0.8rem', marginLeft: '4px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>VDP ENGINE</span>
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <a href="#vdp-types" className="nav-link">Supported VDP</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#comparison" className="nav-link">Why IDexo</a>
            <a href="#faq" className="nav-link">FAQ</a>
            <a href="#download" className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.875rem' }}>
              <Download size={15} /> Download Desktop App
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-layout" style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', alignItems: 'flex-start' }}>
          
          <div className="hero-badge">
            <Zap size={14} className="text-indigo-400" />
            <span>Universal Variable Data Printing (VDP) OS</span>
          </div>

          <h1 className="display-hero">
            The Next-Gen <span className="gradient-text">Variable Data Printing</span> Engine for Commercial Press
          </h1>

          <p style={{ fontSize: '1.15rem', color: '#cbd5e1', lineHeight: '1.7', maxWidth: '640px' }}>
            Automate high-volume variable data workflows for ID cards, event credentials, certificates, membership badges, and personalized mailers. Intake client rosters directly, auto-map variable fields, and compile 100% vector print-ready A3/A4 PDFs in seconds.
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '4px' }}>
            <a href="#download" className="btn-primary">
              <Download size={18} /> Download Free Desktop VDP
            </a>
            <a href="/samples/production_sample.pdf" download="production_sample.pdf" className="btn-secondary">
              <FileCode2 size={18} /> Get Imposed PDF Sample
            </a>
          </div>

          <div style={{ display: 'flex', gap: '24px', color: '#94a3b8', fontSize: '0.875rem', flexWrap: 'wrap', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} style={{ color: '#10b981' }} />
              <span>Native macOS, Windows & Linux</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} style={{ color: '#10b981' }} />
              <span>Zero Server Timeout Local PDF Compiler</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} style={{ color: '#10b981' }} />
              <span>Tokenized Self-Serve Data Intake</span>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <img
            src="/hero_dashboard.png"
            alt="IDexo Printing Press Console Dashboard"
            className="hero-mockup-frame"
          />
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            left: '-20px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            backdropFilter: 'blur(12px)',
            borderRadius: '14px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>VDP Batch Status</div>
              <div style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: '700' }}>1,200 VDP Records Imposed (4.1s)</div>
            </div>
          </div>
        </div>
      </section>

      <div className="divider-line" />

      {/* Supported VDP Product Types Showcase */}
      <section id="vdp-types" style={{ padding: '60px 24px', position: 'relative', zIndex: 10, background: 'rgba(255, 255, 255, 0.01)' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', marginBottom: '32px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Supported Variable Data Printing Applications
          </span>
        </div>
        <div className="vdp-grid">
          <div className="vdp-card">
            <IdCard size={28} style={{ color: '#818cf8' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff' }}>Student & Employee ID Cards</span>
          </div>
          <div className="vdp-card">
            <Ticket size={28} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff' }}>Event Passes & Tickets</span>
          </div>
          <div className="vdp-card">
            <Award size={28} style={{ color: '#fbbf24' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff' }}>Certificates & Diplomas</span>
          </div>
          <div className="vdp-card">
            <CreditCard size={28} style={{ color: '#34d399' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff' }}>Membership & Club Cards</span>
          </div>
          <div className="vdp-card">
            <Mail size={28} style={{ color: '#f472b6' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff' }}>Personalized Direct Mail</span>
          </div>
          <div className="vdp-card">
            <Stamp size={28} style={{ color: '#c084fc' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#ffffff' }}>Serial Badges & Luggage Tags</span>
          </div>
        </div>
      </section>

      <div className="divider-line" />

      {/* Metrics / Stats Strip */}
      <section style={{ padding: '60px 24px', position: 'relative', zIndex: 10 }}>
        <div className="stats-grid">
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#818cf8', lineHeight: 1.1 }}>10x</div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '6px', fontWeight: '500' }}>Faster VDP Batch Rendering</div>
          </div>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#34d399', lineHeight: 1.1 }}>0%</div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '6px', fontWeight: '500' }}>Variable Data Copy-Paste Errors</div>
          </div>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#38bdf8', lineHeight: 1.1 }}>100%</div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '6px', fontWeight: '500' }}>CMYK Vector PDF Output</div>
          </div>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#c084fc', lineHeight: 1.1 }}>A3 / A4</div>
            <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '6px', fontWeight: '500' }}>Automated Duplex Imposition</div>
          </div>
        </div>
      </section>

      <div className="divider-line" />

      {/* Interactive Feature Tabs Section */}
      <section id="features" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 60px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="hero-badge" style={{ alignSelf: 'center' }}>Engineered for Commercial VDP Printing</div>
            <h2 className="headline-section">Everything You Need to Scale Variable Printing</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>
              Four core pillars designed to automate variable text, images, barcodes, and serial numbers without manual design merges.
            </p>
          </div>

          {/* Tab Selector */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '48px' }}>
            <button className={`tab-btn ${activeTab === 'intake' ? 'active' : ''}`} onClick={() => setActiveTab('intake')}>
              <Smartphone size={18} /> 1. Self-Serve VDP Intake
            </button>
            <button className={`tab-btn ${activeTab === 'designer' ? 'active' : ''}`} onClick={() => setActiveTab('designer')}>
              <Sliders size={18} /> 2. Dynamic VDP Blueprint Canvas
            </button>
            <button className={`tab-btn ${activeTab === 'grid' ? 'active' : ''}`} onClick={() => setActiveTab('grid')}>
              <LayoutGrid size={18} /> 3. Duplex Sheet Imposition Engine
            </button>
            <button className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => setActiveTab('billing')}>
              <ClipboardList size={18} /> 4. Instant Billing & Job Tracking
            </button>
          </div>

          {/* Active Tab Showcase Content */}
          <div className="glass-panel" style={{ padding: '48px' }}>
            {activeTab === 'intake' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="hero-badge">Tokenized Data Collection</div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff' }}>
                    Let Clients Input Rosters, Photos & Custom Fields Directly
                  </h3>
                  <p style={{ color: '#cbd5e1', lineHeight: '1.6', fontSize: '1rem' }}>
                    Send tokenized form links to clients for ID cards, event attendee rosters, or certificate recipient lists. Recipients submit details and crop photos on any mobile or desktop device.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> No more hunting for missing photos or broken Excel spreadsheets
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> In-browser ISO photo alignment and cropping tools
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Departmental sub-links for multi-department data delegation
                    </li>
                  </ul>
                </div>
                <div>
                  <img src="/feature_data_collection.png" alt="Client Intake Portal" className="hero-mockup-frame" />
                </div>
              </div>
            )}

            {activeTab === 'designer' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="hero-badge">Universal Variable Canvas</div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff' }}>
                    Design Your Template Once. Synthesize Thousands of Personalized Items.
                  </h3>
                  <p style={{ color: '#cbd5e1', lineHeight: '1.6', fontSize: '1rem' }}>
                    Map exact coordinates for photos, dynamic names, dates (DOB, DOJ, Issue Date), barcodes, and QR codes. Works for ID cards, badges, certificates, tickets, and membership tags.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Native support for custom date formats and serialized numbering
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Font weight mapping and custom Google Fonts support
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Reusable VDP layout templates across batches and clients
                    </li>
                  </ul>
                </div>
                <div>
                  <img src="/feature_template_designer.png" alt="Template Coordinate Canvas" className="hero-mockup-frame" />
                </div>
              </div>
            )}

            {activeTab === 'grid' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="hero-badge">Automated Imposition Grid</div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff' }}>
                    Print-Ready Sheet Placement with Mirrored Backs & Crop Marks
                  </h3>
                  <p style={{ color: '#cbd5e1', lineHeight: '1.6', fontSize: '1rem' }}>
                    Stop spending hours manually placing variable items in InDesign or CorelDRAW. IDexo calculates sheet margins, gutters, bleed guidelines, and perfectly aligns front and back sides for duplex printing.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Supports A3, A4, and custom substrate dimensions
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Automatic corner registration crop marks & cutting lines
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Zero server timeouts — rendering completes locally
                    </li>
                  </ul>
                </div>
                <div>
                  <img src="/feature_production_grid.png" alt="Duplex Imposition Grid" className="hero-mockup-frame" />
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="hero-badge">Commercial Bookkeeping</div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff' }}>
                    Auto-Calculate Job Yields & Generate Commercial Invoices
                  </h3>
                  <p style={{ color: '#cbd5e1', lineHeight: '1.6', fontSize: '1rem' }}>
                    Keep your commercial printing shop accounting clean. Calculate total VDP item counts, unit prices, tax rates (GST), and export instant client PDF invoices right after compilation.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Automated tax parameters (GST 18%) & custom currency
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Real-time payment state tracking (UNPAID, PARTIAL, PAID)
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Downloadable invoice PDFs and client record archives
                    </li>
                  </ul>
                </div>
                <div>
                  <img src="/feature_press_console.png" alt="GST Billing & Invoicing Console" className="hero-mockup-frame" />
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      <div className="divider-line" />

      {/* Before vs After ROI Comparison */}
      <section id="comparison" style={{ padding: '100px 24px', position: 'relative', zIndex: 10, background: 'rgba(255, 255, 255, 0.01)' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 64px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="hero-badge" style={{ alignSelf: 'center', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)' }}>
              Operational ROI
            </div>
            <h2 className="headline-section">Manual VDP Merges vs. The IDexo Engine</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>
              Compare traditional print shop VDP merges with automated IDexo variable printing workflows.
            </p>
          </div>

          <div className="vs-comparison-grid">
            
            {/* Legacy Column */}
            <div className="glass-panel" style={{ borderColor: 'rgba(239, 68, 68, 0.2)', borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <CircleX size={20} />
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#f87171' }}>Legacy Manual VDP Workflow</h3>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>✕</span>
                  <span>Days spent downloading, organizing, and renaming individual photos from WhatsApp.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>✕</span>
                  <span>Cleaning messy Excel files with broken columns and misspelled names.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>✕</span>
                  <span>Manual mail-merges or copy-pasting data into CorelDRAW or InDesign per item.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>✕</span>
                  <span>Manual imposition placement leading to misaligned back-to-back duplex prints.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>✕</span>
                  <span>Costly reprints due to typos or corrupted field data detected after printing.</span>
                </li>
              </ul>
            </div>

            {/* IDexo Column */}
            <div className="glass-panel" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', borderLeft: '4px solid #10b981', background: 'rgba(16, 185, 129, 0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <CircleCheckBig size={20} />
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#34d399' }}>The IDexo VDP Engine</h3>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.5', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                  <span>Clients upload roster data and crop photos directly into your encrypted intake link.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.5', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                  <span>Variable data is validated before submission — 0% corrupt records or missing fields.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.5', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                  <span>Single-click synthesis maps variable records into your template canvas instantly.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.5', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                  <span>Automated A3/A4 duplex grid imposition with 3mm bleed margins and registration crop marks.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.5', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                  <span>100% vector PDF output compiled locally on your desktop in under 5 seconds.</span>
                </li>
              </ul>
            </div>

          </div>

        </div>
      </section>

      <div className="divider-line" />

      {/* OS Download Center */}
      <section id="download" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 64px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="hero-badge" style={{ alignSelf: 'center' }}>Cross-Platform Native Apps</div>
            <h2 className="headline-section">Download IDexo VDP Engine for Your Press</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>
              Free to download and run on any local workstation. Install the desktop press console and start compiling VDP jobs immediately.
            </p>
          </div>

          <div className="os-downloads-grid">
            
            {/* Windows Card */}
            <div className="glass-panel" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', marginBottom: '20px' }}>
                <Monitor size={32} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#ffffff', marginBottom: '6px' }}>Windows</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '24px' }}>Windows 10 / 11 (64-bit)</p>
              <a href="#" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <Download size={16} /> Download .exe
              </a>
            </div>

            {/* macOS Card */}
            <div className="glass-panel" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', marginBottom: '20px' }}>
                <Apple size={32} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#ffffff', marginBottom: '6px' }}>macOS</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '24px' }}>macOS 12 Monterey or newer</p>
              <a href="#" className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
                <Download size={16} /> Download .dmg
              </a>
            </div>

            {/* Linux Card */}
            <div className="glass-panel" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', marginBottom: '20px' }}>
                <Terminal size={32} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#ffffff', marginBottom: '6px' }}>Linux</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '24px' }}>Ubuntu 20.04+ / Debian AppImage</p>
              <a href="#" className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
                <Download size={16} /> Download .AppImage
              </a>
            </div>

          </div>

        </div>
      </section>

      <div className="divider-line" />

      {/* FAQ Accordion Section */}
      <section id="faq" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="hero-badge" style={{ marginBottom: '16px' }}>Support & Knowledge</div>
            <h2 className="headline-section">Frequently Asked Questions</h2>
          </div>

          <FaqAccordion />

        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '80px 24px 48px 24px', backgroundColor: '#040814', borderTop: '1px solid var(--border-glass)', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          
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
            
            <div style={{ maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: '10px',
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
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff' }}>
                  IDexo<span style={{ color: '#818cf8', fontSize: '0.75rem', marginLeft: '4px', textTransform: 'uppercase' }}>VDP ENGINE</span>
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6' }}>
                High-performance vector Variable Data Printing (VDP) compilation engine and tokenized data intake platform engineered for commercial printing presses.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '64px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffffff' }}>
                  Platform
                </span>
                <a href="#vdp-types" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>Supported VDP</a>
                <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>Features</a>
                <a href="#comparison" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>Why IDexo</a>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffffff' }}>
                  Resources
                </span>
                <a href="#faq" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>FAQ</a>
                <a href="#download" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>Desktop Apps</a>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', fontSize: '0.875rem', color: '#64748b' }}>
            <span>© {new Date().getFullYear()} IDexo Technologies. Built for printing presses.</span>
            <div style={{ display: 'flex', gap: '24px' }}>
              <a href="#" style={{ color: '#64748b', textDecoration: 'none' }}>Privacy Policy</a>
              <a href="#" style={{ color: '#64748b', textDecoration: 'none' }}>Terms of Service</a>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}