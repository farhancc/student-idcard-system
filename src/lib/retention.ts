import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { basePrisma } from '@/lib/prisma';
import { deleteManyFromR2 } from '@/lib/storage';
import { config } from '@/lib/config';
import { RETENTION_MONTHS, PURGE_BATCH_LIMIT } from '@/lib/retention-constants';

export { RETENTION_MONTHS, PURGE_BATCH_LIMIT };

const JWT_SECRET = new TextEncoder().encode(config.jwtSecret);


/** Rough per-object sizes, used only to show "space you will free" before purging. */
export const AVG_PHOTO_BYTES = 150_000;
export const AVG_CARD_ASSET_BYTES = 300_000;
export const AVG_PDF_BYTES = 1_500_000;

export interface PurgeScope {
  pressId: number;
  clientIds: number[];
  /** Inclusive lower bound. Always set — an open-ended purge is how history gets destroyed. */
  from: Date;
  /** Inclusive upper bound. */
  to: Date;
}

export interface PurgeTargets {
  scope: PurgeScope;
  cardholderIds: number[];
  orderIds: number[];
  r2Keys: string[];
  counts: { cardholders: number; photos: number; cardAssets: number; pdfJobs: number };
  estimatedBytes: number;
  /** Cardholders matching the scope in total, ignoring the batch limit. */
  totalInScope: number;
  hasMore: boolean;
}

/**
 * Resolve everything a purge would touch, without touching it.
 *
 * The single definition of "what is in scope", shared by the preview, the export
 * and the purge, so the three can never disagree about which records are covered.
 *
 * Uses `basePrisma` with explicit `pressId` filters rather than the tenant-scoped
 * client, because a purge specifically needs what that client hides: rows already
 * soft-deleted (their photos are pure waste and are exactly what we want to
 * reclaim) and result sets past its implicit `take: 5000` cap, which would
 * silently under-purge. Every query below must therefore carry `pressId` itself.
 */
export async function collectPurgeTargets(
  scope: PurgeScope,
  opts: { limit?: number; cardholderIds?: number[] } = {}
): Promise<PurgeTargets> {
  const { pressId, clientIds, from, to } = scope;

  const empty: PurgeTargets = {
    scope,
    cardholderIds: [],
    orderIds: [],
    r2Keys: [],
    counts: { cardholders: 0, photos: 0, cardAssets: 0, pdfJobs: 0 },
    estimatedBytes: 0,
    totalInScope: 0,
    hasMore: false,
  };
  if (clientIds.length === 0) return empty;

  // Bounded at BOTH ends. An upper bound alone sweeps up all prior history.
  const createdAt = { gte: from, lte: to };
  const cardholderWhere = {
    pressId,
    clientId: { in: clientIds },
    createdAt,
    ...(opts.cardholderIds ? { id: { in: opts.cardholderIds } } : {}),
  };

  const totalInScope = await basePrisma.cardholder.count({ where: cardholderWhere });

  const cardholders = await basePrisma.cardholder.findMany({
    where: cardholderWhere,
    select: { id: true, photoUrl: true },
    orderBy: { createdAt: 'asc' }, // oldest first, so repeated batches drain the scope
    take: opts.limit ?? PURGE_BATCH_LIMIT,
  });
  if (cardholders.length === 0) return { ...empty, totalInScope };

  const cardholderIds = cardholders.map((c: { id: number }) => c.id);

  const cardAssets = await basePrisma.cardAsset.findMany({
    where: { pressId, cardholderId: { in: cardholderIds } },
    select: { frontUrl: true, backUrl: true },
  });

  // Orders are derived from the cardholders in THIS batch, never from the date
  // range alone. With more cardholders in scope than PURGE_BATCH_LIMIT, a range
  // query soft-deletes orders whose members are not purged until a later batch,
  // and destroys their PDF jobs while those cards are still live. The `createdAt`
  // bound is kept as a second guard so no link can reach outside the window.
  const links = await basePrisma.orderCardholder.findMany({
    where: { cardholderId: { in: cardholderIds } },
    select: { orderId: true },
  });
  const linkedOrderIds = [...new Set(links.map((l: { orderId: number }) => l.orderId))];

  const linkedOrders = linkedOrderIds.length
    ? await basePrisma.cardOrder.findMany({
        where: { pressId, clientId: { in: clientIds }, createdAt, id: { in: linkedOrderIds } },
        select: { id: true },
      })
    : [];

  // An order that keeps members beyond this batch stays live: those cards are
  // still in service. It is swept by the later batch that drains it.
  const retained = linkedOrders.length
    ? await basePrisma.orderCardholder.findMany({
        where: {
          orderId: { in: linkedOrders.map((o: { id: number }) => o.id) },
          cardholderId: { notIn: cardholderIds },
        },
        select: { orderId: true },
      })
    : [];
  const retainedIds = new Set(retained.map((r: { orderId: number }) => r.orderId));

  const orderIds = linkedOrders
    .map((o: { id: number }) => o.id)
    .filter((id: number) => !retainedIds.has(id));

  const pdfJobs = orderIds.length
    ? await basePrisma.pdfJob.findMany({
        where: { pressId, orderId: { in: orderIds } },
        select: { id: true, downloadUrl: true },
      })
    : [];

  const chunks = pdfJobs.length
    ? await basePrisma.pdfJobChunk.findMany({
        where: { pdfJobId: { in: pdfJobs.map((j: { id: number }) => j.id) } },
        select: { downloadUrl: true },
      })
    : [];

  // Every blob this scope owns. CardAsset faces and PdfJobChunk files are
  // included deliberately: nothing else in the codebase ever deletes them, so
  // until now they were cascade-dropped from the DB and orphaned in R2 forever.
  // OrderInvoice.invoicePdfUrl is deliberately absent — invoices are retained.
  const r2Keys: string[] = [];
  let photos = 0;
  for (const ch of cardholders) {
    if (ch.photoUrl) {
      r2Keys.push(ch.photoUrl);
      photos++;
    }
  }
  for (const a of cardAssets) {
    if (a.frontUrl) r2Keys.push(a.frontUrl);
    if (a.backUrl) r2Keys.push(a.backUrl);
  }
  for (const j of pdfJobs) if (j.downloadUrl) r2Keys.push(j.downloadUrl);
  for (const c of chunks) if (c.downloadUrl) r2Keys.push(c.downloadUrl);

  return {
    scope,
    cardholderIds,
    orderIds,
    r2Keys,
    counts: {
      cardholders: cardholders.length,
      photos,
      cardAssets: cardAssets.length,
      pdfJobs: pdfJobs.length,
    },
    estimatedBytes:
      photos * AVG_PHOTO_BYTES +
      cardAssets.length * AVG_CARD_ASSET_BYTES +
      pdfJobs.length * AVG_PDF_BYTES,
    totalInScope,
    hasMore: totalInScope > cardholders.length,
  };
}

export interface PurgeResult {
  cardholdersDeleted: number;
  ordersArchived: number;
  pdfJobsDeleted: number;
  filesDeleted: number;
  filesFailed: string[];
}

/**
 * Hard-delete the bulk data in `targets`, then reclaim its R2 objects.
 *
 * The DB transaction runs first: it is the source of truth, and a half-done R2
 * sweep only leaves orphans (the status quo before this feature), which the
 * audit entry records for a later pass. The reverse order could delete a photo
 * and then leave a live row pointing at it.
 */
export async function executePurge(targets: PurgeTargets): Promise<PurgeResult> {
  const { scope, cardholderIds, orderIds, r2Keys } = targets;
  const { pressId } = scope;

  if (cardholderIds.length === 0 && orderIds.length === 0) {
    return { cardholdersDeleted: 0, ordersArchived: 0, pdfJobsDeleted: 0, filesDeleted: 0, filesFailed: [] };
  }

  const now = new Date();

  const [, pdfJobsDeleted, cardholdersDeleted, ordersArchived] = await basePrisma.$transaction([
    // 1. Clear the RESTRICT-protected join rows first. Without this the
    //    cardholder delete below throws for anyone who appears in an order,
    //    which aborted every purge this system has ever attempted.
    basePrisma.orderCardholder.deleteMany({ where: { cardholderId: { in: cardholderIds } } }),

    // 2. PDF jobs (cascades pdf_job_chunks and pdf_download_logs).
    basePrisma.pdfJob.deleteMany({ where: { pressId, orderId: { in: orderIds } } }),

    // 3. Cardholders (cascades card_assets, cardholder_values, card_print_records).
    basePrisma.cardholder.deleteMany({ where: { pressId, id: { in: cardholderIds } } }),

    // 4. Orders are SOFT-deleted, never destroyed. Their invoices, delivery
    //    records and activity logs are RESTRICT-protected on purpose
    //    (migration 20260907140000) and are the financial/audit trail we keep.
    basePrisma.cardOrder.updateMany({
      where: { pressId, id: { in: orderIds }, deletedAt: null },
      data: { deletedAt: now },
    }),
  ]);

  const { deleted: filesDeleted, failed: filesFailed } = await deleteManyFromR2(r2Keys);

  return {
    cardholdersDeleted: cardholdersDeleted.count,
    ordersArchived: ordersArchived.count,
    pdfJobsDeleted: pdfJobsDeleted.count,
    filesDeleted,
    filesFailed,
  };
}

// ── Purge authorisation token ───────────────────────────────────────────────
// A purge may only destroy records that were verifiably written into a backup
// ZIP first. The export route signs the scope and a digest of the ids it
// actually embedded; the purge route will not act on anything else. This
// replaces a client-supplied id array that previously included records whose
// photo download had failed.

export interface PurgeTokenClaims {
  pressId: number;
  clientIds: number[];
  from: string;
  to: string;
  idsHash: string;
}

/** Order-independent digest of an exported id set. */
export function hashCardholderIds(ids: number[]): string {
  return crypto
    .createHash('sha256')
    .update([...ids].sort((a, b) => a - b).join(','))
    .digest('hex');
}

export async function signPurgeToken(claims: PurgeTokenClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
}

/**
 * Verify a purge token and confirm it authorises exactly `ids`.
 *
 * @returns the scope to purge, or null if the token is invalid, expired, issued
 *          to another press, or does not cover this exact set of ids.
 */
export async function verifyPurgeToken(
  token: string,
  pressId: number,
  ids: number[]
): Promise<PurgeScope | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const claims = payload as unknown as PurgeTokenClaims;

    if (claims.pressId !== pressId) return null;
    if (claims.idsHash !== hashCardholderIds(ids)) return null;

    return {
      pressId,
      clientIds: claims.clientIds,
      from: new Date(claims.from),
      to: new Date(claims.to),
    };
  } catch {
    return null;
  }
}

/** The cut-off before which data is eligible for automatic archiving. */
export function retentionCutoff(monthsOld = RETENTION_MONTHS): Date {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsOld);
  return cutoff;
}
