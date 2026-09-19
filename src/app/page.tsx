'use client';

import React from 'react';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { DownloadSection } from '@/components/landing/DownloadSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { FooterSection } from '@/components/landing/FooterSection';

export default function LandingPage() {
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

        .desktop-nav,
        .desktop-auth {
          display: flex;
        }

        .mobile-menu-toggle {
          display: none;
          background: transparent;
          border: none;
          color: #ffffff;
          cursor: pointer;
          padding: 6px;
          align-items: center;
          justify-content: center;
        }

        .mobile-nav-panel {
          position: fixed;
          top: 76px;
          left: 0;
          right: 0;
          z-index: 99;
          background: rgba(7, 13, 30, 0.98);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-glass);
          display: flex;
          flex-direction: column;
          padding: 12px 24px 24px;
          max-height: calc(100vh - 76px);
          overflow-y: auto;
        }
        .mobile-nav-panel .nav-link {
          padding: 14px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 1rem;
        }
        .mobile-nav-panel .mobile-auth {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }
        .mobile-nav-panel .mobile-auth a {
          justify-content: center;
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

        /* Text+screenshot layout inside each Features tab panel */
        .feature-tab-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
        }

        @media (max-width: 1024px) {
          .idexo-header-inner .desktop-nav,
          .idexo-header-inner .desktop-auth {
            display: none;
          }
          .mobile-menu-toggle {
            display: flex;
          }
          .feature-tab-grid {
            grid-template-columns: 1fr;
          }
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

      <LandingHeader />
      <HeroSection />
      <FeaturesSection />
      <DownloadSection />
      <FaqSection />
      <FooterSection />
    </div>
  );
}