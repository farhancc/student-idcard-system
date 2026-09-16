import { prisma } from '@/lib/prisma';
import { deleteManyFromR2 } from '@/lib/storage';

export interface TemplateDeleteResult {
  status: 'deleted' | 'hidden' | 'in_use';
  filesDeleted: number;
  filesFailed: string[];
}

/**
 * Deletes a template, freeing storage when it's safe to and hiding it
 * otherwise.
 *
 * Purchasing a template clones it into the buyer's own library, but the
 * clone's image URLs and the /api/marketplace/download gateway both point at
 * *this* row's files (see src/app/api/marketplace/purchase/route.ts and
 * src/app/api/marketplace/download/route.ts) — they are never re-uploaded
 * per buyer. So a template with any TemplatePurchase record can't have its
 * row or files removed without breaking every buyer that already owns it.
 *
 * - No purchases: hard delete — the row and every associated R2 file
 *   (preview + original + source assets) are removed for good.
 * - Has purchases: soft delete — `isPublic: false` and `deletedAt` are set so
 *   it disappears from the marketplace and the seller's own template list,
 *   while the row and files stay intact for existing buyers.
 * - Still in use by one of this template's own orders (`CardOrder.template`
 *   is a required, RESTRICT-protected relation): refuses to delete rather
 *   than let Postgres reject it as an unhandled FK violation.
 */
export async function deleteOrHideTemplate(templateId: number): Promise<TemplateDeleteResult> {
  const purchaseCount = await prisma.templatePurchase.count({ where: { templateId } });

  if (purchaseCount > 0) {
    await prisma.cardTemplate.update({
      where: { id: templateId },
      data: { isPublic: false, deletedAt: new Date() },
    });
    return { status: 'hidden', filesDeleted: 0, filesFailed: [] };
  }

  const activeOrderCount = await prisma.cardOrder.count({ where: { templateId } });
  if (activeOrderCount > 0) {
    return { status: 'in_use', filesDeleted: 0, filesFailed: [] };
  }

  const template = await prisma.cardTemplate.findUnique({
    where: { id: templateId },
    select: {
      frontImageUrl: true,
      backImageUrl: true,
      frontOriginalUrl: true,
      backOriginalUrl: true,
      cdrFileUrl: true,
      aiFileUrl: true,
      psdFileUrl: true,
      pdfFileUrl: true,
    },
  });

  const r2Keys = [
    template?.frontImageUrl,
    template?.backImageUrl,
    template?.frontOriginalUrl,
    template?.backOriginalUrl,
    template?.cdrFileUrl,
    template?.aiFileUrl,
    template?.psdFileUrl,
    template?.pdfFileUrl,
  ].filter((url): url is string => Boolean(url));

  await prisma.cardTemplate.delete({ where: { id: templateId } });

  const { deleted, failed } = await deleteManyFromR2(r2Keys);
  return { status: 'deleted', filesDeleted: deleted, filesFailed: failed };
}
