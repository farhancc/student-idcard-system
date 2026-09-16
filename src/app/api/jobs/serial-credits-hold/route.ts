import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { writeAuditLog, getActorFromRequest, AuditActions } from '@/lib/audit-log';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * POST /api/jobs/serial-credits-hold
 *
 * Reserves credits for a Serial Printer ZIP-combine job, before the (local,
 * Electron-only) render runs. Flat rate per source PDF — this feature has no
 * CardTemplate to derive a per-card rate from, unlike batch-credits-hold.
 * Settled the same way: POST /api/jobs/batch-credits-settle with the
 * returned holdId, which is generic over CreditHold rows and does not care
 * which endpoint created them.
 */

const SERIAL_PDF_CREDIT_COST = 20;
const MAX_PDFS_PER_BATCH = 2000;

const schema = z.object({
  pdfCount: z.union([z.number(), z.string().transform(Number)]),
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
    const { pdfCount } = validation.data;

    if (!Number.isFinite(pdfCount) || pdfCount < 1 || !Number.isInteger(pdfCount)) {
      return NextResponse.json({ error: 'pdfCount must be a positive integer' }, { status: 400 });
    }
    if (pdfCount > MAX_PDFS_PER_BATCH) {
      return NextResponse.json({ error: `A ZIP batch cannot exceed ${MAX_PDFS_PER_BATCH} PDFs.` }, { status: 400 });
    }

    const totalCreditsNeeded = pdfCount * SERIAL_PDF_CREDIT_COST;

    let insufficient = false;
    const result = await prisma.$transaction(async (tx) => {
      const presses = await tx.$queryRaw<any[]>`
        SELECT id, credits, promo_credits FROM "press" WHERE id = ${pressId} FOR UPDATE
      `;
      const press = presses[0];
      if (!press) throw new Error('Press tenant not found');

      const paidCredits = Number(press.credits || 0);
      const promoCredits = Number(press.promo_credits || 0);
      const totalAvailable = paidCredits + promoCredits;

      if (totalAvailable < totalCreditsNeeded) {
        insufficient = true;
        return { totalAvailable, remaining: totalAvailable, holdId: 0 };
      }

      const promoDeduct = Math.min(promoCredits, totalCreditsNeeded);
      const paidDeduct = totalCreditsNeeded - promoDeduct;
      await tx.press.update({
        where: { id: pressId },
        data: {
          ...(paidDeduct > 0 ? { credits: { decrement: paidDeduct } } : {}),
          ...(promoDeduct > 0 ? { promoCredits: { decrement: promoDeduct } } : {}),
        },
      });

      const hold = await tx.creditHold.create({
        data: {
          pressId,
          amount: totalCreditsNeeded,
          reason: 'SERIAL_PRINT_ZIP',
        },
      });

      return { totalAvailable, remaining: totalAvailable - totalCreditsNeeded, holdId: hold.id };
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
      resourceType: 'CreditHold',
      resourceId: result.holdId,
      description: `Serial Printer ZIP-combine by user ${userId}: reserved ${totalCreditsNeeded} credits for ${pdfCount} PDF(s)`,
      newValue: { credits: totalCreditsNeeded, creditsBalance: result.remaining },
    });

    return NextResponse.json({
      success: true,
      holdId: result.holdId,
      creditsCharged: totalCreditsNeeded,
      remainingCredits: result.remaining,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to reserve credits' }, { status: 500 });
  }
}
