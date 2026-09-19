import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const productionCompleteSchema = z.object({
  jobId: z.union([z.number(), z.string().transform(Number)]),
  success: z.boolean(),
  errorMsg: z.string().optional(),
  localPath: z.string().optional(),
  chunkCount: z.number().optional(),
});

export async function POST(request: Request) {
  try {
    // Completion settles credits and revenue against the press.
    const auth = requireRole(request, ['OWNER', 'OPERATOR']);
    if ('response' in auth) return auth.response;
    const { pressId, userId, name: actorName } = auth.actor;let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const validation = productionCompleteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request parameters', details: validation.error.format() }, { status: 400 });
    }

    const { jobId, success, errorMsg, localPath, chunkCount } = validation.data;


    // Process the entire completion flow inside an interactive transaction to prevent race conditions / double refunds
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the PDF job row
      const jobs = await tx.$queryRaw<any[]>`
        SELECT id, status, pdf_type AS "pdfType", order_id AS "orderId", credits_locked AS "creditsLocked", rate_applied AS "rateApplied", revenue_generated AS "revenueGenerated", error_msg AS "errorMsg", download_url AS "downloadUrl"
        FROM "pdf_jobs"
        WHERE id = ${Number(jobId)} AND press_id = ${pressId}
        FOR UPDATE
      `;
      const job = jobs[0];

      if (!job) {
        throw new Error('PDF Job not found');
      }

      // Allow FAILED jobs (cancelled by user) to be reconciled as completed retroactively
      const wasCancelled = job.status === 'FAILED';
      if (job.status !== 'PENDING' && job.status !== 'PROCESSING' && !wasCancelled) {
        throw new Error('Job is already completed');
      }

      if (success) {
        // The bytes themselves arrive on PUT /api/jobs/[id]/pdf, which sets
        // downloadUrl when it manages to store them. That copy wins; otherwise
        // point at the operator's own file so the job still has a source.
        let downloadUrl = '';
        if (chunkCount && chunkCount > 1) {
          // Multi-chunk job: chunks were already uploaded individually.
          // Set downloadUrl to indicate multi-part.
          downloadUrl = `multi-part://${chunkCount}`;

          // Chunks are cut and uploaded as soon as they're big enough, before
          // the final count is known — each one's own totalChunks column was
          // a provisional "at least this many so far" at that point. Now
          // that the job has settled, the count is final; backfill it.
          await tx.pdfJobChunk.updateMany({
            where: { pdfJobId: Number(jobId) },
            data: { totalChunks: chunkCount },
          });
        } else if (!job.downloadUrl && localPath) {
          const formattedPath = localPath.replace(/\\/g, '/');
          const prefix = (formattedPath.startsWith('/') || !/^[a-zA-Z]:/.test(formattedPath)) ? '' : '/';
          downloadUrl = `local://${prefix}${formattedPath}`;
        }

        // Success Flow
        let creditsUsed = job.creditsLocked || 0;

        // If the job was previously cancelled/failed, creditsLocked was reset to 0. We must calculate the credit cost.
        if (wasCancelled && success) {
          const order = await tx.cardOrder.findUnique({
            where: { id: job.orderId },
            include: {
              _count: { select: { cardholders: true } }
            }
          });
          const cardCount = order?._count.cardholders || 0;

          if (job.pdfType === 'PRODUCTION' && order) {
            const template = await tx.cardTemplate.findUnique({
              where: { id: order.templateId },
            });
            const isDoubleSided = !!template?.backImageUrl;
            const isIDCard = template?.category === 'ID_CARD';

            const { getCreditSettings } = require('@/lib/system-settings');
            const creditSettings = await getCreditSettings();
            const costPerCard = isIDCard
              ? (isDoubleSided ? creditSettings.costDoubleSided : creditSettings.costSingleSided)
              : (isDoubleSided ? creditSettings.costDoubleSidedFull : creditSettings.costSingleSidedFull);
            creditsUsed = cardCount * costPerCard;
          } else if (job.pdfType === 'APPROVAL' && order) {
            const template = await tx.cardTemplate.findUnique({
              where: { id: order.templateId },
            });
            const isDoubleSided = !!template?.backImageUrl;
            const { getCreditSettings } = require('@/lib/system-settings');
            const creditSettings = await getCreditSettings();
            creditsUsed = isDoubleSided ? creditSettings.costApprovalPdfDouble : creditSettings.costApprovalPdfSingle;
          }
        }

        let rate = Number(job.rateApplied || 0);
        let rev = Number(job.revenueGenerated || 0);
        if (rate === 0 && creditsUsed > 0) {
          const press = await tx.press.findUnique({
            where: { id: pressId },
            select: { plan: true },
          });
          const { getCreditSettings } = require('@/lib/system-settings');
          const creditSettings = await getCreditSettings();
          const plan = press?.plan || 'BASIC';
          if (plan === 'PRO') {
            rate = creditSettings.priceCreditPro;
          } else if (plan === 'ENTERPRISE') {
            rate = creditSettings.priceCreditEnterprise;
          } else {
            rate = creditSettings.priceCreditBasic;
          }
          rev = creditsUsed * rate;
        } else if (wasCancelled && creditsUsed > 0 && rate > 0 && rev === 0) {
          rev = creditsUsed * rate;
        }

        // If the job was previously cancelled/failed, we must deduct the credits now (since they were refunded)
        if (wasCancelled && creditsUsed > 0) {
          // Lock the Press row first before updating to prevent concurrency locks/clashes
          await tx.$queryRaw`
            SELECT id FROM "press" WHERE id = ${pressId} FOR UPDATE
          `;

          // Deduct from the Press active balance (even if it goes negative)
          await tx.press.update({
            where: { id: pressId },
            data: {
              credits: {
                decrement: creditsUsed,
              },
            },
          });
        }

        await tx.pdfJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            progress: 100,
            creditsLocked: 0, // Unlock credits as they are successfully used
            creditsUsed: creditsUsed,
            rateApplied: rate,
            revenueGenerated: rev,
            completedAt: new Date(),
            downloadUrl: downloadUrl || undefined,
            errorMsg: null, // Clear failure/cancellation error message
          },
        });

        // Transition order status if PRODUCTION
        if (job.pdfType === 'PRODUCTION') {
          const order = await tx.cardOrder.findUnique({
            where: { id: job.orderId },
            include: { cardholders: true }
          });
          if (order) {
            await tx.cardOrder.update({
              where: { id: job.orderId },
              data: { status: 'PRINTING' },
            });

            // Record print logs using createMany batch
            if (order.cardholders.length > 0) {
              const now = new Date();
              await tx.cardPrintRecord.createMany({
                data: order.cardholders.map(ch => ({
                  cardholderId: ch.cardholderId,
                  pressId,
                  orderId: order.id,
                  status: 'PRINTED',
                  printedAt: now,
                })),
              });
            }

            const logNote = wasCancelled
              ? `Compiled production layout (Retroactive Sync). Charged ${creditsUsed} credits due to previous cancellation.`
              : `Compiled production layout. Deducted ${creditsUsed} credits.`;

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
                note: logNote,
              },
            });
          }
        }

        return { success: true, message: 'Job completed and credits captured' };
      } else {
        // If the job was already cancelled, do not refund again
        if (wasCancelled) {
          return { success: true, message: 'Job was already cancelled/failed. No action taken.' };
        }

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
            creditsUsed: 0,
            revenueGenerated: 0,
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
  } catch (error: unknown) {
    console.error('Complete PDF job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
