import { prisma } from '../prisma';
import { PDFGeneratorFactory, PdfGeneratorOptions } from './generators';
import fs from 'fs';
import path from 'path';

/**
 * Checks subscription limits and trial validation before executing print orders.
 */
export async function verifySubscriptionLimits(pressId: number, cardCount: number, pdfType: string): Promise<{ allowed: boolean; reason?: string }> {
  const press = await prisma.press.findUnique({
    where: { id: pressId },
  });

  if (!press) {
    return { allowed: false, reason: 'Press tenant not found' };
  }

  if (!press.isActive) {
    return { allowed: false, reason: 'Your press account is suspended. Please contact admin.' };
  }

  const now = new Date();

  // 1. Check Trial limits (14 days or max 100 cards total)
  if (press.trialEndsAt && press.trialEndsAt > press.createdAt) {
    if (now > press.trialEndsAt) {
      return { allowed: false, reason: 'Your 14-day free trial has expired. Please upgrade to a paid plan.' };
    }

    // Count all print records generated during trial
    const totalPrinted = await prisma.cardPrintRecord.count({
      where: { pressId },
    });

    if (totalPrinted + cardCount > 100) {
      return { allowed: false, reason: `Trial limit exceeded. You can print up to 100 cards on trial (Printed: ${totalPrinted}, Attempting: ${cardCount}). Please upgrade.` };
    }
  }

  // 2. Check Plan limits
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyCount = await prisma.cardPrintRecord.count({
    where: {
      pressId,
      createdAt: { gte: startOfMonth },
    },
  });

  if (press.plan === 'BASIC') {
    // Basic limits
    if (pdfType === 'PRODUCTION') {
      return { allowed: false, reason: 'Production grid exports (with crop marks/bleeds) are only available on PRO plans and above.' };
    }
    if (cardCount > 500) {
      return { allowed: false, reason: 'BASIC plan limit: Maximum 500 cards per order.' };
    }
    if (monthlyCount + cardCount > 10000) {
      return { allowed: false, reason: 'BASIC plan limit: Maximum 10,000 cards per month exceeded.' };
    }
  } else if (press.plan === 'PRO') {
    // Pro limits
    if (cardCount > 2500) {
      return { allowed: false, reason: 'PRO plan limit: Maximum 2,500 cards per order.' };
    }
    if (monthlyCount + cardCount > 50000) {
      return { allowed: false, reason: 'PRO plan limit: Maximum 50,000 cards per month exceeded.' };
    }
  }

  return { allowed: true };
}

/**
 * Runs a PDF generation job asynchronously in the background.
 */
export async function processPdfJobInBackground(
  jobId: number,
  pressId: number,
  orderId: number,
  cardholderIds: number[],
  pdfType: string,
  options: PdfGeneratorOptions,
  userId: number
): Promise<void> {
  // Start job execution inside an unawaited promise
  (async () => {
    try {
      // 1. Update job to PROCESSING
      await prisma.pdfJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING', progress: 5 },
      });

      // 2. Fetch appropriate generator from factory
      const generator = PDFGeneratorFactory.getGenerator(pdfType);

      // 3. Generate PDF and track progress
      const pdfBuffer = await generator.generate(
        pressId,
        orderId,
        cardholderIds,
        options,
        async (percent: number) => {
          // Progress updates in DB
          await prisma.pdfJob.update({
            where: { id: jobId },
            data: { progress: Math.min(95, Math.max(5, percent)) },
          });
        }
      );

      const isCloudinaryConfigured = 
        process.env.CLOUDINARY_CLOUD_NAME && 
        process.env.CLOUDINARY_API_KEY && 
        process.env.CLOUDINARY_API_SECRET;

      let downloadUrl = '';
      const fileName = `${pdfType.toLowerCase()}_order_${orderId}_job_${jobId}.pdf`;

      if (isCloudinaryConfigured) {
        console.log(`Uploading PDF Job #${jobId} to Cloudinary...`);
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
        const pdfDir = isProd
          ? path.join('/tmp', 'idexo', String(pressId), 'pdfs')
          : path.join(process.cwd(), 'public', 'uploads', String(pressId), 'pdfs');
        fs.mkdirSync(pdfDir, { recursive: true });

        const filePath = path.join(pdfDir, fileName);
        fs.writeFileSync(filePath, pdfBuffer);

        downloadUrl = `/uploads/${pressId}/pdfs/${fileName}`;
      }

      // 5. If PRODUCTION pdf is completed, mark card printing records in print log
      if (pdfType === 'PRODUCTION') {
        const order = await prisma.cardOrder.findUnique({ where: { id: orderId } });
        if (order) {
          // Update order status to PRODUCTION_PDF_GENERATED
          // Wait, order status values in our schema / plan: DRAFT | APPROVAL_PDF_SENT | APPROVED | PRINTING | DELIVERED
          // Let's set it to APPROVED or PRINTING depending on workflow.
          await prisma.cardOrder.update({
            where: { id: orderId },
            data: { status: 'PRINTING' },
          });

          // Insert or update print records for each cardholder
          for (const chId of cardholderIds) {
            await prisma.cardPrintRecord.create({
              data: {
                cardholderId: chId,
                pressId,
                orderId,
                status: 'PRINTED',
                printedAt: new Date(),
              },
            });
          }

          // Add to order activity log
          await prisma.orderActivityLog.create({
            data: {
              orderId,
              pressId,
              actorId: userId,
              actorName: 'System Queue',
              action: 'PDF_PRODUCTION_GENERATED',
              fromStatus: order.status,
              toStatus: 'PRINTING',
              note: `Generated production layout PDF. Printed ${cardholderIds.length} cards.`,
            },
          });
        }
      }

      // 6. Complete job in DB
      await prisma.pdfJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          downloadUrl,
          completedAt: new Date(),
        },
      });

      console.log(`✅ PDF Job #${jobId} completed successfully. Saved to ${downloadUrl}`);
    } catch (err: any) {
      console.error(`❌ PDF Job #${jobId} failed:`, err);
      // Fail job in DB
      await prisma.pdfJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMsg: err.message || 'Unknown error occurred during PDF generation',
          completedAt: new Date(),
        },
      });
    }
  })();
}
