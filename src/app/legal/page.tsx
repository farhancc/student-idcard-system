import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL_DOCUMENTS } from '@/lib/legal/documents';
import { getLegalIdentity, legalIdentityWarnings } from '@/lib/legal/company';
import type { LegalAudience } from '@/lib/legal/types';

// The published identity comes from runtime environment variables, so these
// pages are rendered per request rather than baked at build time — otherwise a
// deployment that configures LEGAL_* after the build would serve placeholders.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Legal documents',
  description: 'Terms of Service, Privacy Policy, Data Processing Addendum and the other documents that govern use of IDexo.',
};

const GROUPS: { audience: LegalAudience; heading: string }[] = [
  { audience: 'PRESS', heading: 'For printing presses' },
  { audience: 'CLIENT', heading: 'For client organisations' },
  { audience: 'CARDHOLDER', heading: 'For cardholders, students and parents' },
  { audience: 'PUBLIC', heading: 'For everyone' },
];

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function LegalIndexPage() {
  const identity = getLegalIdentity();
  const warnings = legalIdentityWarnings();

  // A document aimed at several audiences is listed under the first group it
  // matches, so nothing appears twice on the page.
  const placed = new Set<string>();

  return (
    <main>
      <h1>Legal documents</h1>
      <p className="legal-lede">
        Everything that governs the use of {identity.brand}, in one place. Each document carries a version
        number and an effective date; we record which version you accepted, and ask you to accept a new one
        when it changes materially.
      </p>

      {GROUPS.map(group => {
        const docs = LEGAL_DOCUMENTS.filter(
          doc => doc.audiences.includes(group.audience) && !placed.has(doc.slug)
        );
        docs.forEach(doc => placed.add(doc.slug));
        if (docs.length === 0) return null;

        return (
          <div className="legal-index-group" key={group.audience}>
            <h2>{group.heading}</h2>
            <div className="legal-card-grid">
              {docs.map(doc => (
                <Link className="legal-card" href={`/legal/${doc.slug}`} key={doc.slug}>
                  <h3>{doc.title}</h3>
                  <p>{doc.summary}</p>
                  <span>
                    Version {doc.version} · effective {formatDate(doc.effectiveDate)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {process.env.NODE_ENV !== 'production' && warnings.length > 0 && (
        <div className="legal-config-warning">
          <strong>Not ready to publish.</strong> These documents are falling back to placeholder identity
          details because the following environment variables are unset:{' '}
          {warnings.map((name, i) => (
            <React.Fragment key={name}>
              {i > 0 && ', '}
              <code>{name}</code>
            </React.Fragment>
          ))}
          . Set them before offering the service commercially — a published policy has to name a real,
          reachable entity. This warning is hidden in production.
        </div>
      )}

      <div className="legal-footer">
        <p>
          Questions about any of this: <a href={`mailto:${identity.contactEmail}`}>{identity.contactEmail}</a>.
          Privacy and data requests: <a href={`mailto:${identity.privacyEmail}`}>{identity.privacyEmail}</a>.
          Complaints: <Link href="/legal/grievance-redressal">Grievance Redressal Policy</Link>.
        </p>
      </div>
    </main>
  );
}
