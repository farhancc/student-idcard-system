'use client';

import React from 'react';
import FaqAccordion from '../../app/components/FaqAccordion';

export function FaqSection() {
  return (
    <section id="faq" style={{ padding: '100px 24px', position: 'relative', zIndex: 10 }}>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div className="hero-badge" style={{ marginBottom: '16px' }}>Support & Knowledge</div>
          <h2 className="headline-section">Frequently Asked Questions</h2>
        </div>
        <FaqAccordion />
      </div>
    </section>
  );
}
