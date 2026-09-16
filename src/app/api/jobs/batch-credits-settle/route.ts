import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { writeAuditLog, getActorFromRequest, AuditActions } from '@/lib/audit-log';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * POST /api/jobs/batch-credits-settle
 *
 * Resolves a CreditHold created by batch-credits-hold: `success: true`
 * captures it (the balance was already decremented at hold time, so this is
 * bookkeeping only — mirrors PdfJob production-complete's success path,
 * which likewise never re-touches Press.credits); `success: false` refunds
 * the held amount back to the press. Mirrors production-complete's
 * refund branch, scoped to a CreditHold instead of a PdfJob.
 *
 * The hold's `amount` is read from the DB row, never the client — a caller
 * cannot inflate a refund past what was actually reserved. Only a PENDING
 * hold can be settled, so a retried or duplicate call cannot double-refund.
 */

const schema = z.object({
  holdId: z.union([z.number(), z.string().transform(Number)]),
  success: z.boolean(),
});

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const auth = requireRole(request, ['OWNER', 'OPERATOR']);
    if ('response' in auth) return auth.response;
    const pressId = auth.actor.pressId;

    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: validation.error.format() },
        { status: 400 },
      );
    }
    const { holdId, success } = validation.data;

    const result = await prisma.$transaction(async (tx) => {
      const holds = await tx.$queryRaw<any[]>`
        SELECT id, press_id AS "pressId", amount, status
        FROM "credit_holds"
        WHERE id = ${holdId} AND press_id = ${pressId}
        FOR UPDATE
      `;
      const hold = holds[0];
      if (!hold) throw new Error('Credit hold not found');
      if (hold.status !== 'PENDING') throw new Error(`Credit hold is already ${hold.status.toLowerCase()}`);

      if (success) {
        await tx.creditHold.update({
          where: { id: holdId },
          data: { status: 'CAPTURED', settledAt: new Date() },
        });
        return { status: 'CAPTURED', refunded: 0, remaining: null as number | null };
      }

      // Lock the Press row before updating, same as every other refund path.
      await tx.$queryRaw`SELECT id FROM "press" WHERE id = ${pressId} FOR UPDATE`;

      const press = await tx.press.update({
        where: { id: pressId },
        data: { credits: { increment: hold.amount } },
        select: { credits: true },
      });

      await tx.creditHold.update({
        where: { id: holdId },
        data: { status: 'REFUNDED', settledAt: new Date() },
      });

      return { status: 'REFUNDED', refunded: hold.amount, remaining: press.credits };
    });

    void writeAuditLog({
      ...getActorFromRequest(request),
      action: result.status === 'REFUNDED' ? AuditActions.CREDITS_REFUNDED : AuditActions.CREDITS_DEDUCTED,
      category: 'BILLING',
      resourceType: 'CreditHold',
      resourceId: holdId,
      description: result.status === 'REFUNDED'
        ? `Local batch compile failed: refunded ${result.refunded} credit(s)`
        : `Local batch compile succeeded: captured hold #${holdId}`,
      newValue: result.remaining != null ? { creditsBalance: result.remaining } : undefined,
    });

    return NextResponse.json({ success: true, status: result.status, remainingCredits: result.remaining });
  } catch (e: any) {
    const message = e.message || 'Failed to settle credit hold';
    const status = message.includes('not found') ? 404 : message.includes('already') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
