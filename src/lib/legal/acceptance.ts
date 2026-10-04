import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/rate-limit';
import { documentsForConsentPoint } from './documents';
import type { ConsentPoint, LegalDocument } from './types';

/** Whose agreement a row records. */
export type LegalSubjectType = 'PRESS_USER' | 'CLIENT' | 'CARDHOLDER';

/** Which consent point governs each kind of subject. */
const POINT_BY_SUBJECT: Record<LegalSubjectType, ConsentPoint> = {
  PRESS_USER: 'PRESS_SIGNUP',
  CLIENT: 'CLIENT_SIGNUP',
  CARDHOLDER: 'CARDHOLDER_ENROLMENT',
};

export interface AcceptanceContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Where the acceptance came from. Recorded because "they ticked a box" is not
 * evidence of anything unless you can say when, and from where.
 */
export function acceptanceContextFromRequest(request: Request): AcceptanceContext {
  return {
    ipAddress: getClientIp(request) || null,
    // Truncated: a user agent is attacker-controlled and unbounded.
    userAgent: request.headers.get('user-agent')?.slice(0, 512) ?? null,
  };
}

/**
 * Minimal surface so a `$transaction` client can be passed in unchanged.
 * Method syntax, not a property with a function type, so TypeScript compares
 * the argument bivariantly and Prisma's precisely-typed client structurally
 * satisfies it.
 */
type AcceptanceWriter = {
  legalAcceptance: {
    createMany(args: { data: AcceptanceRow[]; skipDuplicates?: boolean }): Promise<unknown>;
  };
};

interface AcceptanceRow {
  pressId: number;
  subjectType: LegalSubjectType;
  subjectId: number;
  documentSlug: string;
  version: string;
  ipAddress: string | null;
  userAgent: string | null;
  guardianName: string | null;
  guardianRelation: string | null;
}

export interface RecordAcceptanceOptions {
  point: ConsentPoint;
  subjectType: LegalSubjectType;
  subjectId: number;
  pressId: number;
  context: AcceptanceContext;
  /** Set only where a guardian accepted for a child cardholder. */
  guardian?: { name: string; relation: string } | null;
  /**
   * A transaction client, so the acceptance and the record it relates to are
   * written atomically. Defaults to the shared client.
   */
  client?: AcceptanceWriter;
}

/**
 * Record agreement to every document required at `point`, at the version
 * currently published. The versions are read server-side: a client that claims
 * to have accepted v1.0 of something cannot pin itself to an old version.
 */
export async function recordLegalAcceptance(opts: RecordAcceptanceOptions): Promise<void> {
  const documents = documentsForConsentPoint(opts.point);
  if (documents.length === 0) return;

  const writer = (opts.client ?? (prisma as unknown as AcceptanceWriter));

  await writer.legalAcceptance.createMany({
    data: documents.map(doc => ({
      pressId: opts.pressId,
      subjectType: opts.subjectType,
      subjectId: opts.subjectId,
      documentSlug: doc.slug,
      version: doc.version,
      ipAddress: opts.context.ipAddress,
      userAgent: opts.context.userAgent,
      guardianName: opts.guardian?.name ?? null,
      guardianRelation: opts.guardian?.relation ?? null,
    })),
    // Re-accepting a version already on file is a no-op, not an error.
    skipDuplicates: true,
  });
}

/**
 * Documents the subject has not accepted at the currently published version —
 * either because they predate the document, or because it has been revised.
 * Empty means nothing is outstanding.
 */
export async function pendingLegalDocuments(
  subjectType: LegalSubjectType,
  subjectId: number
): Promise<LegalDocument[]> {
  const required = documentsForConsentPoint(POINT_BY_SUBJECT[subjectType]);
  if (required.length === 0) return [];

  const accepted = await prisma.legalAcceptance.findMany({
    where: {
      subjectType,
      subjectId,
      documentSlug: { in: required.map(d => d.slug) },
    },
    select: { documentSlug: true, version: true },
  });

  const onFile = new Set(accepted.map(a => `${a.documentSlug}@${a.version}`));
  return required.filter(doc => !onFile.has(`${doc.slug}@${doc.version}`));
}
