import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const productionCompleteSchema = z.object({
  jobId: z.union([z.number(), z.string().transform(Number)]),
  success: z.boolean(),
  errorMsg: z.string().optional(),
  pdfBase64: z.string().optional(),
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

    const { jobId, success, errorMsg, pdfBase64 } = validation.data;


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
        let downloadUrl = '';
        if (pdfBase64) {
          const pdfBuffer = Buffer.from(pdfBase64, 'base64');
          const isCloudinaryConfigured = 
            process.env.CLOUDINARY_CLOUD_NAME && 
            process.env.CLOUDINARY_API_KEY && 
            process.env.CLOUDINARY_API_SECRET;

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
                  folder: `press_${pressId}/pdfs`,
                  resource_type: 'raw',
                  public_id: fileName.replace('.pdf', ''),
                },
                (error: any, result: any) => {
                  if (error) reject(error);
                  else resolve(result);
                }
              ).end(pdfBuffer);
            });

            downloadUrl = uploadResult.secure_url;
          } else {
            const isProd = process.env.VERCEL || process.env.NODE_ENV === 'production';
            const fs = require('fs');
            const path = require('path');
            const pdfDir = isProd
              ? path.join('/tmp', 'idexo', String(pressId), 'pdfs')
              : path.join(process.cwd(), 'public', 'uploads', String(pressId), 'pdfs');
            fs.mkdirSync(pdfDir, { recursive: true });

            const filePath = path.join(pdfDir, fileName);
            fs.writeFileSync(filePath, pdfBuffer);

            downloadUrl = `/uploads/${pressId}/pdfs/${fileName}`;
          }
        }

        // Success Flow
        await tx.pdfJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            progress: 100,
            creditsLocked: 0, // Unlock credits as they are successfully used
            completedAt: new Date(),
            downloadUrl: downloadUrl || undefined,
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
