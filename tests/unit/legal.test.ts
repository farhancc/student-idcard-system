import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LEGAL_DOCUMENTS,
  getLegalDocument,
  documentsForConsentPoint,
} from '@/lib/legal/documents';
import { getLegalIdentity, legalIdentityWarnings } from '@/lib/legal/company';
import { SUBPROCESSORS } from '@/lib/legal/subprocessors';
import type { ConsentPoint } from '@/lib/legal/types';
import {
  signupSchema,
  clientSignupSchema,
  enrolmentConsentSchema,
  marketplacePublishSchema,
} from '@/lib/schemas';

const identity = getLegalIdentity();

describe('legal document registry', () => {
  it('has a unique slug per document', () => {
    const slugs = LEGAL_DOCUMENTS.map(d => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('exposes every document by slug', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      expect(getLegalDocument(doc.slug)).toBe(doc);
    }
    expect(getLegalDocument('no-such-document')).toBeUndefined();
  });

  it('gives every document a version, an ISO effective date and an audience', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      expect(doc.version, doc.slug).toMatch(/^\d+\.\d+$/);
      expect(doc.effectiveDate, doc.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(doc.effectiveDate)), doc.slug).toBe(false);
      expect(doc.audiences.length, doc.slug).toBeGreaterThan(0);
      expect(doc.title.length, doc.slug).toBeGreaterThan(0);
      expect(doc.summary.length, doc.slug).toBeGreaterThan(0);
    }
  });

  it('renders complete, well-formed sections for every document', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const sections = doc.sections(identity);
      expect(sections.length, doc.slug).toBeGreaterThan(0);

      const ids = sections.map(s => s.id);
      // Section ids become URL anchors, so a duplicate would make a clause
      // unlinkable.
      expect(new Set(ids).size, `${doc.slug} anchors`).toBe(ids.length);

      for (const section of sections) {
        expect(section.heading.length, `${doc.slug}#${section.id}`).toBeGreaterThan(0);
        expect(section.blocks.length, `${doc.slug}#${section.id}`).toBeGreaterThan(0);

        for (const block of section.blocks) {
          if (block.kind === 'text' || block.kind === 'note') {
            expect(block.text.trim().length, `${doc.slug}#${section.id}`).toBeGreaterThan(0);
          } else if (block.kind === 'list') {
            expect(block.items.length, `${doc.slug}#${section.id}`).toBeGreaterThan(0);
          } else {
            // Every row must line up with the header, or the table renders
            // cells under the wrong column.
            for (const row of block.rows) {
              expect(row.length, `${doc.slug}#${section.id}`).toBe(block.columns.length);
            }
          }
        }
      }
    }
  });

  it('leaves no placeholder markers in the published text', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const flat = JSON.stringify(doc.sections(identity));
      expect(flat, doc.slug).not.toMatch(/TODO|FIXME|XXX|\{\{/);
      // An unresolved template literal would surface as the word "undefined".
      expect(flat, doc.slug).not.toContain('undefined');
    }
  });

  it('publishes the same subprocessor list in the Privacy Policy and the DPA annex', () => {
    const names = SUBPROCESSORS.map(s => s.name);
    for (const slug of ['privacy', 'data-processing-addendum']) {
      const flat = JSON.stringify(getLegalDocument(slug)!.sections(identity));
      for (const name of names) {
        expect(flat, `${slug} is missing ${name}`).toContain(name);
      }
    }
  });
});

describe('consent points', () => {
  const EXPECTED: Record<ConsentPoint, string[]> = {
    PRESS_SIGNUP: ['terms', 'privacy', 'acceptable-use', 'data-processing-addendum', 'billing'],
    CLIENT_SIGNUP: ['client-terms'],
    CARDHOLDER_ENROLMENT: ['cardholder-notice'],
    MARKETPLACE_PUBLISH: ['marketplace'],
  };

  it('requires the expected documents at each point in the product', () => {
    for (const [point, slugs] of Object.entries(EXPECTED) as [ConsentPoint, string[]][]) {
      expect(documentsForConsentPoint(point).map(d => d.slug).sort()).toEqual([...slugs].sort());
    }
  });

  it('declares a consent point only for a document that exists', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      for (const point of doc.consentPoints) {
        expect(documentsForConsentPoint(point)).toContain(doc);
      }
    }
  });
});

describe('legal identity configuration', () => {
  const ORIGINAL = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL };
  });

  afterEach(() => {
    process.env = ORIGINAL;
  });

  it('reports every unset required variable, so an unconfigured deploy is visible', () => {
    for (const name of Object.keys(process.env)) {
      if (name.startsWith('LEGAL_')) delete process.env[name];
    }
    const warnings = legalIdentityWarnings();
    expect(warnings).toContain('LEGAL_ENTITY_NAME');
    expect(warnings).toContain('LEGAL_GRIEVANCE_OFFICER_EMAIL');
    expect(warnings).toContain('LEGAL_ADDRESS');
  });

  it('reports nothing once the required variables are set', () => {
    Object.assign(process.env, {
      LEGAL_ENTITY_NAME: 'Example Printers Technologies Private Limited',
      LEGAL_ENTITY_FORM: 'a private limited company incorporated in India',
      LEGAL_ADDRESS: '1 Example Road, Bengaluru 560001',
      LEGAL_CONTACT_EMAIL: 'legal@example.com',
      LEGAL_PRIVACY_EMAIL: 'privacy@example.com',
      LEGAL_GRIEVANCE_OFFICER_NAME: 'A. Example',
      LEGAL_GRIEVANCE_OFFICER_EMAIL: 'grievance@example.com',
      LEGAL_GRIEVANCE_OFFICER_PHONE: '+91 80 1234 5678',
      LEGAL_WEBSITE: 'https://example.com',
    });
    expect(legalIdentityWarnings()).toEqual([]);
  });

  it('threads the configured identity into the published text', () => {
    process.env.LEGAL_ENTITY_NAME = 'Example Printers Technologies Private Limited';
    process.env.LEGAL_GRIEVANCE_OFFICER_EMAIL = 'grievance@example.com';

    const flat = JSON.stringify(getLegalDocument('grievance-redressal')!.sections(getLegalIdentity()));
    expect(flat).toContain('Example Printers Technologies Private Limited');
    expect(flat).toContain('grievance@example.com');
  });

  it('falls back to a readable placeholder rather than an empty string', () => {
    for (const name of Object.keys(process.env)) {
      if (name.startsWith('LEGAL_')) delete process.env[name];
    }
    const co = getLegalIdentity();
    expect(co.entityName.trim().length).toBeGreaterThan(0);
    expect(co.address.trim().length).toBeGreaterThan(0);
    expect(co.grievanceOfficerName.trim().length).toBeGreaterThan(0);
  });
});

describe('consent is enforced by the request schemas', () => {
  const pressSignup = {
    pressName: 'Apex Prints',
    ownerName: 'Jane Doe',
    email: 'jane@apexprints.com',
    password: 'superSecretPassword123',
    phone: '+919876543210',
  };

  it('refuses a press signup without acceptance', () => {
    expect(signupSchema.safeParse(pressSignup).success).toBe(false);
    expect(signupSchema.safeParse({ ...pressSignup, acceptedLegal: false }).success).toBe(false);
    expect(signupSchema.safeParse({ ...pressSignup, acceptedLegal: 'yes' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...pressSignup, acceptedLegal: true }).success).toBe(true);
  });

  const clientSignup = { pressId: 1, name: 'Springfield High', type: 'SCHOOL' };

  it('refuses a client organisation signup without acceptance', () => {
    expect(clientSignupSchema.safeParse(clientSignup).success).toBe(false);
    expect(clientSignupSchema.safeParse({ ...clientSignup, acceptedLegal: true }).success).toBe(true);
  });

  it('rejects an unrecognised organisation type', () => {
    const result = clientSignupSchema.safeParse({
      ...clientSignup,
      type: 'MILITARY',
      acceptedLegal: true,
    });
    expect(result.success).toBe(false);
  });

  it('refuses enrolment without consent', () => {
    expect(enrolmentConsentSchema.safeParse({ onBehalfOfMinor: false }).success).toBe(false);
    expect(
      enrolmentConsentSchema.safeParse({ accepted: false, onBehalfOfMinor: false }).success
    ).toBe(false);
    expect(
      enrolmentConsentSchema.safeParse({ accepted: true, onBehalfOfMinor: false }).success
    ).toBe(true);
  });

  it('requires an identified guardian when the cardholder is a child', () => {
    expect(
      enrolmentConsentSchema.safeParse({ accepted: true, onBehalfOfMinor: true }).success
    ).toBe(false);
    expect(
      enrolmentConsentSchema.safeParse({
        accepted: true,
        onBehalfOfMinor: true,
        guardianName: 'Sita Devi',
      }).success
    ).toBe(false);
    expect(
      enrolmentConsentSchema.safeParse({
        accepted: true,
        onBehalfOfMinor: true,
        guardianName: 'Sita Devi',
        guardianRelation: 'Mother',
      }).success
    ).toBe(true);
  });

  it('refuses a marketplace listing without the rights warranty', () => {
    expect(marketplacePublishSchema.safeParse({ templateId: 4, price: 10 }).success).toBe(false);
    expect(
      marketplacePublishSchema.safeParse({
        templateId: 4,
        price: 10,
        acceptedMarketplaceTerms: true,
      }).success
    ).toBe(true);
  });
});

describe('pendingLegalDocuments', () => {
  const findMany = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    findMany.mockReset();
    vi.doMock('@/lib/prisma', () => ({
      prisma: { legalAcceptance: { findMany } },
    }));
  });

  afterEach(() => {
    vi.doUnmock('@/lib/prisma');
  });

  async function load() {
    return (await import('@/lib/legal/acceptance')).pendingLegalDocuments;
  }

  it('returns every required document when nothing is on file', async () => {
    findMany.mockResolvedValue([]);
    const pending = await (await load())('PRESS_USER', 42);
    expect(pending.map(d => d.slug).sort()).toEqual(
      documentsForConsentPoint('PRESS_SIGNUP').map(d => d.slug).sort()
    );
  });

  it('returns nothing once the current version of each is accepted', async () => {
    findMany.mockResolvedValue(
      documentsForConsentPoint('PRESS_SIGNUP').map(d => ({
        documentSlug: d.slug,
        version: d.version,
      }))
    );
    expect(await (await load())('PRESS_USER', 42)).toEqual([]);
  });

  it('re-prompts for a document whose version has moved on', async () => {
    const required = documentsForConsentPoint('PRESS_SIGNUP');
    findMany.mockResolvedValue(
      required.map((d, i) => ({
        documentSlug: d.slug,
        // The first document is only accepted at a superseded version.
        version: i === 0 ? '0.9' : d.version,
      }))
    );
    const pending = await (await load())('PRESS_USER', 42);
    expect(pending.map(d => d.slug)).toEqual([required[0].slug]);
  });

  it('scopes the lookup to the subject it was asked about', async () => {
    findMany.mockResolvedValue([]);
    await (await load())('CARDHOLDER', 7);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ subjectType: 'CARDHOLDER', subjectId: 7 }),
      })
    );
  });
});
