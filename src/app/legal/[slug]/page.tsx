import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DocumentBody } from '../DocumentBody';
import { getLegalDocument } from '@/lib/legal/documents';
import { getLegalIdentity } from '@/lib/legal/company';

// See the note in ../page.tsx: the identity is runtime configuration.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDocument(slug);
  if (!doc) return { title: 'Not found' };

  return {
    title: doc.title,
    description: doc.summary,
    // A policy page has no business in search results for a rival's brand, but
    // it must be indexable — people look these up before they sign up.
    robots: { index: true, follow: true },
  };
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function LegalDocumentPage({ params }: Props) {
  const { slug } = await params;
  const doc = getLegalDocument(slug);
  if (!doc) notFound();

  const identity = getLegalIdentity();
  const sections = doc.sections(identity);

  return (
    <main>
      <article>
        <h1>{doc.title}</h1>
        <p className="legal-lede">{doc.summary}</p>

        <div className="legal-meta">
          <span>
            <strong>Version</strong> {doc.version}
          </span>
          <span>
            <strong>Effective</strong> {formatDate(doc.effectiveDate)}
          </span>
          <span>
            <strong>Published by</strong> {identity.entityName}
          </span>
        </div>

        <nav className="legal-toc" aria-label="Contents">
          <h2>Contents</h2>
          <ol>
            {sections.map(section => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.heading}</a>
              </li>
            ))}
          </ol>
        </nav>

        <DocumentBody sections={sections} />
      </article>

      <div className="legal-footer">
        <p>
          {doc.title}, version {doc.version}, effective {formatDate(doc.effectiveDate)}. Earlier versions are
          available on request from{' '}
          <a href={`mailto:${identity.contactEmail}`}>{identity.contactEmail}</a>.
        </p>
        <p>
          <Link href="/legal">All legal documents</Link>
        </p>
      </div>
    </main>
  );
}
