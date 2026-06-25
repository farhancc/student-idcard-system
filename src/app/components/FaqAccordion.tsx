'use client';

import React, { useState } from 'react';

const faqItems = [
  {
    q: "Is IDexo a web app or a desktop app?",
    a: "IDexo is a desktop application. You download and install it on your Windows, macOS, or Linux machine. The user-friendly templates and databases are managed securely through your dashboard, letting you compile production-ready ID card batches directly from your local computer."
  },
  {
    q: "Do I need to switch away from CorelDRAW entirely?",
    a: "No. IDexo handles the production and data side — data collection, card generation, sheet layout, and PDF output. If you use CorelDRAW for other design work, keep using it. For ID card jobs specifically, IDexo automates template mapping and print-ready sheet layout, saving you hours of manual copy-paste."
  },
  {
    q: "My clients are not very tech-savvy. Will they be able to use the submission form?",
    a: "Yes. The form your clients receive is a simple link that opens in any mobile or desktop browser — no account, no login, and no app download is needed on their end. If they can fill a basic form online, they can submit their details and crop their photos easily."
  },
  {
    q: "What types of ID cards can I produce with IDexo?",
    a: "Any ID card that has data and a photo. School and college student IDs, corporate employee cards, hospital staff credentials, event badges, government department IDs — all work with IDexo. You can maintain separate templates and client profiles for each type of job."
  },
  {
    q: "Can I use my own card design, or am I stuck with templates IDexo provides?",
    a: "You build your own templates inside IDexo — you have full control over colors, fonts, logo placement, field positions, QR codes, barcodes, and layout. You can match any client's brand identity exactly. Once a template is built, it reuses automatically across every new batch for that client."
  },
  {
    q: "Is the client's data secure? We handle data for schools and hospitals.",
    a: "Yes. Data submitted through IDexo is stored securely with encryption. Submission links are unique per job and can be set to expire. Your clients' data is never shared with any third party. For hospital and government jobs requiring additional compliance, contact us directly."
  },
  {
    q: "We do large jobs — sometimes 2,000 to 3,000 cards. Can IDexo handle that?",
    a: "Yes. IDexo is built for volume. Whether it's 50 cards for a small company or 3,000 for a university, generation time is measured in seconds. The production grid calculates and lays out however many print sheets your job requires — automatically."
  }
];

export default function FaqAccordion() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {faqItems.map((item, idx) => (
        <div 
          key={idx} 
          className="glass-card" 
          style={{ 
            padding: '20px 24px', 
            cursor: 'pointer',
            border: activeFaq === idx ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: activeFaq === idx ? '0 0 20px rgba(255, 255, 255, 0.05)' : 'none',
            transition: 'all 0.3s ease',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
          onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: '600' }}>{item.q}</h4>
            <span style={{ 
              color: '#9ca3af', 
              fontSize: '1.2rem',
              transform: activeFaq === idx ? 'rotate(45deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}>
              +
            </span>
          </div>
          {activeFaq === idx && (
            <p className="saas-body-md" style={{ fontSize: '0.95rem', marginTop: '12px', color: '#d1d5db', lineHeight: '1.6' }}>
              {item.a}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
