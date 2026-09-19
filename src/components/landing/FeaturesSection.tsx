'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Smartphone, Sliders, LayoutGrid, ClipboardList,
  CheckCircle2, CircleX, CircleCheckBig
} from 'lucide-react';

export function FeaturesSection() {
  const [activeTab, setActiveTab] = useState<'intake' | 'designer' | 'grid' | 'billing'>('intake');

  return (
    <>
      {/* Interactive Feature Tabs Section */}
      <section id="features" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 60px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="hero-badge" style={{ alignSelf: 'center' }}>How It Works</div>
            <h2 className="headline-section">Everything You Need to Run a Card Printing Job</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>
              From collecting client data to printing the final sheet — four steps, no manual copy-pasting.
            </p>
          </div>

          {/* Tab Selector */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '48px' }}>
            <button className={`tab-btn ${activeTab === 'intake' ? 'active' : ''}`} onClick={() => setActiveTab('intake')}>
              <Smartphone size={18} /> 1. Client Data Collection
            </button>
            <button className={`tab-btn ${activeTab === 'designer' ? 'active' : ''}`} onClick={() => setActiveTab('designer')}>
              <Sliders size={18} /> 2. Template Designer
            </button>
            <button className={`tab-btn ${activeTab === 'grid' ? 'active' : ''}`} onClick={() => setActiveTab('grid')}>
              <LayoutGrid size={18} /> 3. Print Sheet Layout
            </button>
            <button className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => setActiveTab('billing')}>
              <ClipboardList size={18} /> 4. Billing & Invoicing
            </button>
          </div>

          {/* Active Tab Showcase Content */}
          <div className="glass-panel" style={{ padding: '48px' }}>
            {activeTab === 'intake' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="hero-badge">Client Self-Service</div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff' }}>
                    Let Clients Submit Their Own Rosters and Photos
                  </h3>
                  <p style={{ color: '#cbd5e1', lineHeight: '1.6', fontSize: '1rem' }}>
                    Send your client a link. They fill in names and details, then upload and crop photos, right from their phone or computer — no spreadsheets to chase down.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> No more hunting for missing photos or broken Excel spreadsheets
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Built-in photo cropping and alignment, right in the browser
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Separate links per department or class, if you need them
                    </li>
                  </ul>
                </div>
                <div>
                  <Image src="/feature_data_collection.png" alt="Client Intake Portal" width={800} height={500} className="hero-mockup-frame" style={{ width: '100%', height: 'auto' }} />
                </div>
              </div>
            )}

            {activeTab === 'designer' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="hero-badge">Design Once, Reuse Forever</div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff' }}>
                    Design the Template Once — Reuse It for Every Batch
                  </h3>
                  <p style={{ color: '#cbd5e1', lineHeight: '1.6', fontSize: '1rem' }}>
                    Place photos, names, dates, barcodes, and QR codes exactly where you want them on the card. Save it once, and every new batch for that client uses the same layout automatically. Works for ID cards, badges, certificates, tickets, and membership tags.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Custom date formats and auto-numbered serials, built in
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Any Google Font, any weight
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> One template, reused across every batch and client
                    </li>
                  </ul>
                </div>
                <div>
                  <Image src="/feature_template_designer.png" alt="Template Coordinate Canvas" width={800} height={500} className="hero-mockup-frame" style={{ width: '100%', height: 'auto' }} />
                </div>
              </div>
            )}

            {activeTab === 'grid' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="hero-badge">Automatic Sheet Layout</div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff' }}>
                    Print-Ready Sheets — Fronts, Backs & Crop Marks Aligned
                  </h3>
                  <p style={{ color: '#cbd5e1', lineHeight: '1.6', fontSize: '1rem' }}>
                    Stop spending hours placing cards by hand in InDesign or CorelDRAW. IDexo works out the margins, gutters, and bleed, and lines up the front and back sides for double-sided printing.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> A3, A4, or a custom sheet size
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Crop marks and cutting lines added automatically
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Runs on your own computer — no waiting on a server
                    </li>
                  </ul>
                </div>
                <div>
                  <Image src="/feature_production_grid.png" alt="Duplex Imposition Grid" width={800} height={500} className="hero-mockup-frame" style={{ width: '100%', height: 'auto' }} />
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="hero-badge">Billing, Handled</div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff' }}>
                    Every Job Billed and Invoiced Automatically
                  </h3>
                  <p style={{ color: '#cbd5e1', lineHeight: '1.6', fontSize: '1rem' }}>
                    As soon as a batch is compiled, IDexo totals the card count, applies your pricing and tax rate, and hands you a client-ready invoice PDF.
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> GST and custom tax rates, built in
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Track what's paid, partially paid, or still owed
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <CheckCircle2 size={16} color="#10b981" /> Every invoice saved and downloadable anytime
                    </li>
                  </ul>
                </div>
                <div>
                  <Image src="/feature_press_console.png" alt="GST Billing & Invoicing Console" width={800} height={500} className="hero-mockup-frame" style={{ width: '100%', height: 'auto' }} />
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
              Before &amp; After
            </div>
            <h2 className="headline-section">The Old Way vs. IDexo</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>
              What changes when you stop doing this by hand.
            </p>
          </div>

          <div className="vs-comparison-grid">
            <div className="glass-panel" style={{ borderColor: 'rgba(239, 68, 68, 0.2)', borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <CircleX size={20} />
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#f87171' }}>Doing It by Hand</h3>
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

            <div className="glass-panel" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', borderLeft: '4px solid #10b981', background: 'rgba(16, 185, 129, 0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <CircleCheckBig size={20} />
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#34d399' }}>With IDexo</h3>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.5', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                  <span>Clients submit their roster and crop their own photos through your own link.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.5', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                  <span>Details are checked before submission — no missing fields or bad data.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.5', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                  <span>One click drops every record into your template — no manual matching.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.5', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                  <span>A3/A4 sheets laid out automatically, with 3mm bleed and crop marks in place.</span>
                </li>
                <li style={{ display: 'flex', gap: '12px', fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.5', fontWeight: '500' }}>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                  <span>Print-ready vector PDF, compiled on your own computer in under 5 seconds.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
