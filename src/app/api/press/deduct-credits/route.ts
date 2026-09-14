import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authz';
import { writeAuditLog, getActorFromRequest, AuditActions } from '@/lib/audit-log';

export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['OWNER', 'OPERATOR']);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { jobId } = body || {};
    if (!jobId || typeof jobId !== 'number') {
      return NextResponse.json({ error: 'Valid jobId (number) is required' }, { status: 400 });
    }

    // Lookup job to derive amount server-side
    const job = await prisma.pdfJob.findFirst({
      where: { id: jobId, pressId },
      select: { id: true, creditsLocked: true, creditsUsed: true },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Idempotency: if credits were already used for this job, return success without double charging
    if (job.creditsUsed > 0) {
      const press = await prisma.press.findUnique({
        where: { id: pressId },
        select: { credits: true },
      });
      return NextResponse.json({
        success: true,
        message: 'Credits already deducted for this job',
        creditsBalance: press?.credits ?? 0,
      });
    }

    const amount = job.creditsLocked;
    if (amount <= 0) {
      const press = await prisma.press.findUnique({
        where: { id: pressId },
        select: { credits: true },
      });
      return NextResponse.json({
        success: true,
        message: 'No credits required for this job',
        creditsBalance: press?.credits ?? 0,
      });
    }

    // Use a transaction to safely check and decrement credits and update job
    const result = await prisma.$transaction(async (tx) => {
      const presses = await tx.$queryRaw<any[]>`
        SELECT id, credits, promo_credits FROM "press" WHERE id = ${pressId} FOR UPDATE
      `;
      const press = presses[0];

      if (!press) {
        throw new Error('TENANT_NOT_FOUND');
      }

      const paidCredits = Number(press.credits || 0);
      const promoCredits = Number(press.promo_credits || 0);
      const totalAvailable = paidCredits + promoCredits;

      if (totalAvailable < amount) {
        throw new Error(`INSUFFICIENT_CREDITS:${amount}:${totalAvailable}`);
      }

      const promoDeduct = Math.min(promoCredits, amount);
      const paidDeduct = amount - promoDeduct;

      const updatedPress = await tx.press.update({
        where: { id: pressId },
        data: {
          ...(promoDeduct > 0 ? { promoCredits: { decrement: promoDeduct } } : {}),
          ...(paidDeduct > 0 ? { credits: { decrement: paidDeduct } } : {}),
        },
      });

      await tx.pdfJob.update({
        where: { id: jobId },
        data: { creditsUsed: amount },
      });

      return updatedPress;
    });

    void writeAuditLog({
      ...getActorFromRequest(request),
      action: AuditActions.CREDITS_DEDUCTED,
      category: 'BILLING',
      resourceType: 'PdfJob',
      resourceId: jobId,
      description: `Deducted ${amount} credits for job ${jobId}`,
      newValue: { amount, creditsBalance: result.credits },
    });

    return NextResponse.json({
      success: true,
      creditsBalance: result.credits,
    });
  } catch (error: any) {
    if (error?.message?.startsWith('INSUFFICIENT_CREDITS')) {
      const parts = error.message.split(':');
      return NextResponse.json(
        { error: `Insufficient credits. Required: ${parts[1]}, Available: ${parts[2]}` },
        { status: 402 }
      );
    }
    if (error?.message === 'TENANT_NOT_FOUND') {
      return NextResponse.json({ error: 'Press tenant not found' }, { status: 404 });
    }
    console.error('Deduct credits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
