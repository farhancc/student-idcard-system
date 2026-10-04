import type { Metadata } from 'next';
import Link from 'next/link';
import './legal.css';

export const metadata: Metadata = {
  title: { default: 'Legal', template: '%s · IDexo Legal' },
  description: 'Terms, privacy and data protection documents for IDexo.',
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-page">
      <div className="legal-shell">
        <header className="legal-topbar">
          <Link href="/" className="legal-brand">
            IDexo
          </Link>
          <nav aria-label="Legal documents">
            <Link href="/legal">All documents</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/acceptable-use">Acceptable Use</Link>
            <Link href="/legal/grievance-redressal">Complaints</Link>
          </nav>
        </header>

        {children}
      </div>
    </div>
  );
}
