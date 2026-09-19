'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '#vdp-types', label: 'What You Can Print' },
  { href: '#features', label: 'Features' },
  { href: '#comparison', label: 'Why IDexo' },
  { href: '#faq', label: 'FAQ' },
];

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="idexo-header">
      <div className="idexo-header-inner">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <Image
            src="/icon.png"
            alt="IDexo Logo"
            width={34}
            height={34}
            style={{ borderRadius: '8px' }}
          />
          <span style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#ffffff' }}>
            IDexo <span style={{ color: '#818cf8', fontWeight: '600', fontSize: '0.85rem' }}>for Print Shops</span>
          </span>
        </Link>

        <nav className="desktop-nav" style={{ alignItems: 'center', gap: '32px' }}>
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} className="nav-link">{link.label}</a>
          ))}
        </nav>

        <div className="desktop-auth" style={{ alignItems: 'center', gap: '16px' }}>
          <Link href="/login" className="nav-link">Press Login</Link>
          <Link href="/signup" className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.875rem' }}>
            Get Started <ArrowRight size={16} />
          </Link>
        </div>

        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-nav-panel">
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} className="nav-link" onClick={closeMenu}>{link.label}</a>
          ))}
          <div className="mobile-auth">
            <Link href="/login" className="btn-secondary" onClick={closeMenu}>Press Login</Link>
            <Link href="/signup" className="btn-primary" onClick={closeMenu}>
              Get Started <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
