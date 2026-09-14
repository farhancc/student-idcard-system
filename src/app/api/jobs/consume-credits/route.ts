import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { writeAuditLog, getActorFromRequest, AuditActions } from '@/lib/audit-log';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getCreditSettings } from '@/lib/system-settings';

/**
 * POST /api/jobs/consume-credits
 *
 * Authoritative credit deduction for a LOCAL Batch Import compile. The batch
 * data lives only in the user's browser (IndexedDB) and is rendered/saved
 * locally, so there is no order or PdfJob to hang the deduction off — but
 * credits are a billing asset and must be spent server-side. This mirrors the
 * credit math + atomic deduction in `jobs/production-request` without creating
 * any order/job records.
 *
 * NOTE: because the roster is client-side, `cardCount` is client-reported. The
 * per-card rate is authoritative (derived from the template) and the balance is
 * enforced server-side, but the count cannot be independently verified.
 */

const schema = z.object({
  templateId: z.union([z.number(), z.string().transform(Number)]),
  cardCount: z.union([z.number(), z.string().transform(Number)]),
  pdfType: z.enum(['PRODUCTION', 'APPROVAL']),
});

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    // Spending credits is an owner/operator action (designers must not).
    const auth = requireRole(request, ['OWNER', 'OPERATOR']);
    if ('response' in auth) return auth.response;
    const pressId = auth.actor.pressId;
    const userId = auth.actor.userId;

    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: validation.error.format() },
        { status: 400 },
      );
    }
    const { templateId, cardCount, pdfType } = validation.data;

    if (!Number.isFinite(cardCount) || cardCount < 1) {
      return NextResponse.json({ error: 'cardCount must be a positive integer' }, { status: 400 });
    }

    // Template drives the per-card rate (single vs double, ID card vs full colour).
    const template = await prisma.cardTemplate.findUnique({
      where: { id: Number(templateId) },
      select: { id: true, backImageUrl: true, category: true },
    });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const isProduction = pdfType === 'PRODUCTION';
    const isDoubleSided = !!template.backImageUrl;
    const isIDCard = template.category === 'ID_CARD';

    const creditSettings = await getCreditSettings();
    let totalCreditsNeeded = 0;
    if (isProduction) {
      const costPerCard = isIDCard
        ? (isDoubleSided ? creditSettings.costDoubleSided : creditSettings.costSingleSided)
        : (isDoubleSided ? creditSettings.costDoubleSidedFull : creditSettings.costSingleSidedFull);
      totalCreditsNeeded = Math.ceil(cardCount) * costPerCard;
    } else {
      totalCreditsNeeded = isDoubleSided
        ? creditSettings.costApprovalPdfDouble
        : creditSettings.costApprovalPdfSingle;
    }

    // Atomic check-and-deduct under a pessimistic lock on the press row.
    let insufficient = false;
    const result = await prisma.$transaction(async (tx) => {
      const presses = await tx.$queryRaw<any[]>`
        SELECT id, credits, promo_credits, plan FROM "press" WHERE id = ${pressId} FOR UPDATE
      `;
      const press = presses[0];
      if (!press) throw new Error('Press tenant not found');

      const paidCredits = Number(press.credits || 0);
      const promoCredits = Number(press.promo_credits || 0);
      const totalAvailable = paidCredits + promoCredits;

      if (totalAvailable < totalCreditsNeeded) {
        insufficient = true;
        return { totalAvailable, remaining: totalAvailable };
      }

      if (totalCreditsNeeded > 0) {
        const promoDeduct = Math.min(promoCredits, totalCreditsNeeded);
        const paidDeduct = totalCreditsNeeded - promoDeduct;
        await tx.press.update({
          where: { id: pressId },
          data: {
            ...(paidDeduct > 0 ? { credits: { decrement: paidDeduct } } : {}),
            ...(promoDeduct > 0 ? { promoCredits: { decrement: promoDeduct } } : {}),
          },
        });
      }
      return { totalAvailable, remaining: totalAvailable - totalCreditsNeeded };
    });

    if (insufficient) {
      return NextResponse.json(
        {
          error: `Insufficient credits. This batch requires ${totalCreditsNeeded} credits, but you only have ${result.totalAvailable}.`,
          required: totalCreditsNeeded,
          available: result.totalAvailable,
        },
        { status: 402 },
      );
    }

    void writeAuditLog({
      ...getActorFromRequest(request),
      action: AuditActions.CREDITS_DEDUCTED,
      category: 'BILLING',
      resourceType: 'BatchCompile',
      description: `Local batch ${pdfType} compile by user ${userId}: spent ${totalCreditsNeeded} credits for ${Math.ceil(cardCount)} card(s)`,
      newValue: { credits: totalCreditsNeeded, creditsBalance: result.remaining },
    });

    return NextResponse.json({
      success: true,
      creditsCharged: totalCreditsNeeded,
      remainingCredits: result.remaining,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to consume credits' }, { status: 500 });
  }
}
