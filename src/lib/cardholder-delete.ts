import { prisma } from '@/lib/prisma';
import { deleteManyFromR2 } from '@/lib/storage';

export interface HardDeleteCardholderResult {
  filesDeleted: number;
  filesFailed: string[];
}

/**
 * Permanently removes one or more cardholders and reclaims their storage.
 *
 * Clears the RESTRICT-protected order-membership rows first (without this the
 * delete below throws for any cardholder that has ever been added to an
 * order), then deletes the cardholder rows — cascading CardAsset,
 * CardholderValue and CardPrintRecord — and finally frees the photo and
 * rendered-face objects from R2. Mirrors the ordering used by the bulk
 * retention purge (src/lib/retention.ts `executePurge`), so every "delete
 * cardholder" entry point in the app — single or bulk — frees storage
 * immediately instead of leaving a soft-deleted row and orphaned files
 * behind.
 *
 * The DB delete runs before the R2 sweep: it is the source of truth, and a
 * partially-failed R2 sweep only leaves orphans (the previous status quo),
 * never a live row pointing at a deleted file.
 */
export async function hardDeleteCardholders(cardholderIds: number[]): Promise<HardDeleteCardholderResult> {
  if (cardholderIds.length === 0) return { filesDeleted: 0, filesFailed: [] };

  const [cardholders, cardAssets] = await Promise.all([
    prisma.cardholder.findMany({
      where: { id: { in: cardholderIds } },
      select: { photoUrl: true },
    }),
    prisma.cardAsset.findMany({
      where: { cardholderId: { in: cardholderIds } },
      select: { frontUrl: true, backUrl: true },
    }),
  ]);

  const r2Keys: string[] = [];
  for (const cardholder of cardholders) {
    if (cardholder.photoUrl) r2Keys.push(cardholder.photoUrl);
  }
  for (const asset of cardAssets) {
    if (asset.frontUrl) r2Keys.push(asset.frontUrl);
    if (asset.backUrl) r2Keys.push(asset.backUrl);
  }

  await prisma.$transaction([
    prisma.orderCardholder.deleteMany({ where: { cardholderId: { in: cardholderIds } } }),
    prisma.cardholder.deleteMany({ where: { id: { in: cardholderIds } } }),
  ]);

  const { deleted, failed } = await deleteManyFromR2(r2Keys);
  return { filesDeleted: deleted, filesFailed: failed };
}

/** Single-cardholder convenience wrapper around {@link hardDeleteCardholders}. */
export function hardDeleteCardholder(cardholderId: number): Promise<HardDeleteCardholderResult> {
  return hardDeleteCardholders([cardholderId]);
}
