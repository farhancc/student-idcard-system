'use client';

import React from 'react';
import Image from 'next/image';
import {
  Zap, Download, FileCode2, ShieldCheck,
  IdCard, Ticket, Award, CreditCard, Mail, Stamp
} from 'lucide-react';

export function HeroSection() {
  return (
    <>
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
          <Image
            src="/hero_dashboard.png"
            alt="IDexo Printing Press Console Dashboard"
            width={1200}
            height={800}
            className="hero-mockup-frame"
            style={{ width: '100%', height: 'auto' }}
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
    </>
  );
}
