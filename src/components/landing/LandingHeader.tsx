'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export function LandingHeader() {
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

        <nav style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <a href="#vdp-types" className="nav-link">What You Can Print</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="#comparison" className="nav-link">Why IDexo</a>
          <a href="#faq" className="nav-link">FAQ</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/login" className="nav-link">Press Login</Link>
          <Link href="/signup" className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.875rem' }}>
            Get Started <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
