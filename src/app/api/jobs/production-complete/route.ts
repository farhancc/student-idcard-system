import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const productionCompleteSchema = z.object({
  jobId: z.union([z.number(), z.string().transform(Number)]),
  success: z.boolean(),
  errorMsg: z.string().optional(),
  pdfBase64: z.string().optional(),
  localPath: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');
    if (!pressIdStr || !userIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const userId = Number(userIdStr);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const validation = productionCompleteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request parameters', details: validation.error.format() }, { status: 400 });
    }

    const { jobId, success, errorMsg, pdfBase64, localPath } = validation.data;


    // Process the entire completion flow inside an interactive transaction to prevent race conditions / double refunds
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the PDF job row
      const jobs = await tx.$queryRaw<any[]>`
        SELECT id, status, pdf_type AS "pdfType", order_id AS "orderId", credits_locked AS "creditsLocked", rate_applied AS "rateApplied", revenue_generated AS "revenueGenerated", error_msg AS "errorMsg"
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
        let downloadUrl = '';
        if (localPath) {
          const formattedPath = localPath.replace(/\\/g, '/');
          const prefix = (formattedPath.startsWith('/') || !/^[a-zA-Z]:/.test(formattedPath)) ? '' : '/';
          downloadUrl = `local://${prefix}${formattedPath}`;
        } else if (pdfBase64) {
          const pdfBuffer = Buffer.from(pdfBase64, 'base64');
          const isCloudinaryConfigured = !!(
            process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET
          );

          const fileName = `${job.pdfType.toLowerCase()}_order_${job.orderId}_job_${job.id}.pdf`;

          if (isCloudinaryConfigured) {
            const { v2: cloudinary } = require('cloudinary');
            cloudinary.config({
              cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
              api_key: process.env.CLOUDINARY_API_KEY,
              api_secret: process.env.CLOUDINARY_API_SECRET,
            });

            const uploadResult = await new Promise<any>((resolve, reject) => {
              cloudinary.uploader.upload_stream(
                {
                  folder: `press_${pressId}/compiled_pdfs`,
                  resource_type: 'raw',
                  public_id: fileName,
                },
                (err: any, res: any) => {
                  if (err) reject(err);
                  else resolve(res);
                }
              ).end(pdfBuffer);
            });

            downloadUrl = uploadResult.secure_url;
          } else {
            const isProd = process.env.VERCEL || process.env.NODE_ENV === 'production';
            const fs = require('fs');
            const path = require('path');
            const pdfDir = isProd
              ? path.join('/tmp', 'idexo', 'uploads', String(pressId), 'pdfs')
              : path.join(process.cwd(), 'public', 'uploads', String(pressId), 'pdfs');
            fs.mkdirSync(pdfDir, { recursive: true });

            const filePath = path.join(pdfDir, fileName);
            fs.writeFileSync(filePath, pdfBuffer);

            downloadUrl = `/uploads/${pressId}/pdfs/${fileName}`;
          }
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

            const { getCreditSettings } = require('@/lib/system-settings');
            const creditSettings = await getCreditSettings();
            const costPerCard = isDoubleSided ? creditSettings.costDoubleSided : creditSettings.costSingleSided;
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

            // Record print logs
            for (const ch of order.cardholders) {
              await tx.cardPrintRecord.create({
                data: {
                  cardholderId: ch.cardholderId,
                  pressId,
                  orderId: order.id,
                  status: 'PRINTED',
                  printedAt: new Date(),
                },
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
  } catch (error: any) {
    console.error('Complete PDF job error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
