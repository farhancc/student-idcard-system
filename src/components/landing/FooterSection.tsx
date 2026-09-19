'use client';

import React from 'react';
import Image from 'next/image';

export function FooterSection() {
  return (
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
                <Image
                  src="/logo.png"
                  alt="IDexo Logo"
                  width={26}
                  height={26}
                  style={{
                    objectFit: 'contain',
                    filter: 'brightness(0) invert(1)'
                  }}
                />
              </div>
              <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff' }}>
                IDexo<span style={{ color: '#818cf8', fontSize: '0.75rem', marginLeft: '4px', textTransform: 'uppercase' }}>for Print Shops</span>
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Software print shops use to collect client rosters and photos, and turn them into print-ready ID cards and badges — without the manual busywork.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '64px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffffff' }}>
                Platform
              </span>
              <a href="#vdp-types" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>What You Can Print</a>
              <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>Features</a>
              <a href="#comparison" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>Why IDexo</a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffffff' }}>
                Resources
              </span>
              <a href="#faq" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>FAQ</a>
              <a href="#download" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>Download</a>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', fontSize: '0.875rem', color: '#64748b' }}>
          <span>© {new Date().getFullYear()} IDexo. Built for printing presses.</span>
          <div style={{ display: 'flex', gap: '24px' }}>
            <a href="#" style={{ color: '#64748b', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="#" style={{ color: '#64748b', textDecoration: 'none' }}>Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
