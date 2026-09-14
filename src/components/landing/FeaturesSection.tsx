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
                  <Image src="/feature_data_collection.png" alt="Client Intake Portal" width={800} height={500} className="hero-mockup-frame" style={{ width: '100%', height: 'auto' }} />
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
                  <Image src="/feature_template_designer.png" alt="Template Coordinate Canvas" width={800} height={500} className="hero-mockup-frame" style={{ width: '100%', height: 'auto' }} />
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
                  <Image src="/feature_production_grid.png" alt="Duplex Imposition Grid" width={800} height={500} className="hero-mockup-frame" style={{ width: '100%', height: 'auto' }} />
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
              Operational ROI
            </div>
            <h2 className="headline-section">Manual VDP Merges vs. The IDexo Engine</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>
              Compare traditional print shop VDP merges with automated IDexo variable printing workflows.
            </p>
          </div>

          <div className="vs-comparison-grid">
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
    </>
  );
}
