import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');
    if (!pressIdStr || !userIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const userId = Number(userIdStr);

    const { jobId, success, errorMsg } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Process the entire completion flow inside an interactive transaction to prevent race conditions / double refunds
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the PDF job row
      const jobs = await tx.$queryRaw<any[]>`
        SELECT id, status, pdf_type AS "pdfType", order_id AS "orderId", credits_locked AS "creditsLocked"
        FROM "pdf_jobs"
        WHERE id = ${Number(jobId)} AND press_id = ${pressId}
        FOR UPDATE
      `;
      const job = jobs[0];

      if (!job) {
        throw new Error('PDF Job not found');
      }

      if (job.status !== 'PENDING' && job.status !== 'PROCESSING') {
        throw new Error('Job is already completed or failed');
      }

      if (success) {
        // Success Flow
        await tx.pdfJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            progress: 100,
            creditsLocked: 0, // Unlock credits as they are successfully used
            completedAt: new Date(),
          },
        });

        // Transition order status if PRODUCTION
        if (job.pdfType === 'PRODUCTION') {
          const order = await tx.cardOrder.findUnique({ where: { id: job.orderId } });
          if (order) {
            await tx.cardOrder.update({
              where: { id: job.orderId },
              data: { status: 'PRINTING' },
            });

            // Record print logs
            const cardholderIds: number[] = JSON.parse(order.cardholderIds || '[]');
            for (const chId of cardholderIds) {
              await tx.cardPrintRecord.create({
                data: {
                  cardholderId: chId,
                  pressId,
                  orderId: order.id,
                  status: 'PRINTED',
                  printedAt: new Date(),
                },
              });
            }

            // Create activity log
            await tx.orderActivityLog.create({
              data: {
                orderId: order.id,
                pressId,
                actorId: userId,
                actorName: 'Desktop Client',
                action: 'PDF_PRODUCTION_GENERATED_DESKTOP',
                fromStatus: order.status,
                toStatus: 'PRINTING',
                note: `Compiled production layout. Deducted ${job.creditsLocked} credits.`,
              },
            });
          }
        }

        return { success: true, message: 'Job completed and credits captured' };
      } else {
        // Failure Flow (Refund Credits)
        const refundedCredits = job.creditsLocked;

        // Lock the Press row first before updating to prevent concurrency locks/clashes
        await tx.$queryRaw`
          SELECT id FROM "press" WHERE id = ${pressId} FOR UPDATE
        `;

        // Refund the credits back to the Press
        await tx.press.update({
          where: { id: pressId },
          data: {
            credits: {
              increment: refundedCredits,
            },
          },
        });

        // Mark job as failed and reset creditsLocked to 0
        await tx.pdfJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            progress: 0,
            creditsLocked: 0,
            errorMsg: errorMsg || 'Compilation failed',
            completedAt: new Date(),
          },
        });

        // Add log
        await tx.orderActivityLog.create({
          data: {
            orderId: job.orderId,
            pressId,
            actorId: userId,
            actorName: 'Desktop Client',
            action: 'PDF_JOB_FAILED_DESKTOP',
            fromStatus: 'PROCESSING',
            toStatus: 'FAILED',
            note: `Job compilation failed: ${errorMsg || 'Unknown error'}. Refunded ${refundedCredits} credits.`,
          },
        });

        return { success: true, message: 'Job failed. Credits successfully refunded.', refundedCredits };
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Complete PDF job error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
