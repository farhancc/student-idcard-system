'use client';

import React from 'react';
import { Monitor, Apple, Terminal, Download } from 'lucide-react';

export function DownloadSection() {
  return (
    <>
      <section id="download" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 64px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="hero-badge" style={{ alignSelf: 'center' }}>Available on Every OS</div>
            <h2 className="headline-section">Download IDexo for Your Press</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>
              Free to download and install on any computer. Set up your first template and compile a batch in minutes.
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
              <a href="/api/uploads/releases/IDexoPressClient-Setup-1.0.1.exe" download className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
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
    </>
  );
}
