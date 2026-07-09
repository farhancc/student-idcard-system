import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl } from '@/lib/signed-url';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const jobId = Number(id);

    const job = await prisma.pdfJob.findFirst({
      where: { id: jobId, pressId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if the link has expired
    let isExpired = false;
    if (job.expiresAt && new Date() > job.expiresAt) {
      isExpired = true;
    }

    // Generate a signed download URL (2-hour HMAC token)
    const rawDownloadPath = isExpired ? null : `/api/jobs/${jobId}/download`;
    const signedDownloadUrl = rawDownloadPath
      ? generateSignedUrl(rawDownloadPath, 60 * 60 * 2)
      : null;

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        pdfType: job.pdfType,
        status: job.status,
        progress: job.progress,
        fileName: job.fileName,
        errorMsg: job.errorMsg,
        downloadUrl: signedDownloadUrl,
        isExpired,
        expiresAt: job.expiresAt,
        completedAt: job.completedAt,
        isLocalJob: job.isLocalJob,
      },
    });
  } catch (error) {
    console.error('Get PDF job status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const userId = userIdStr ? Number(userIdStr) : null;
    const { id } = await params;
    const jobId = Number(id);

    // Cancel the job inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock the PDF job row
      const jobs = await tx.$queryRaw<any[]>`
        SELECT id, status, pdf_type AS "pdfType", order_id AS "orderId", credits_locked AS "creditsLocked"
        FROM "pdf_jobs"
        WHERE id = ${jobId} AND press_id = ${pressId}
        FOR UPDATE
      `;
      const job = jobs[0];

      if (!job) {
        throw new Error('PDF Job not found');
      }

      if (job.status !== 'PENDING' && job.status !== 'PROCESSING') {
        throw new Error('Only pending or processing jobs can be cancelled');
      }

      const refundedCredits = job.creditsLocked || 0;

      if (refundedCredits > 0) {
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
      }

      // Mark job as failed/cancelled
      await tx.pdfJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          progress: 0,
          creditsLocked: 0,
          creditsUsed: 0,
          revenueGenerated: 0,
          errorMsg: 'Cancelled by user',
          completedAt: new Date(),
        },
      });

      // Add log
      await tx.orderActivityLog.create({
        data: {
          orderId: job.orderId,
          pressId,
          actorId: userId || 0,
          actorName: 'Dashboard User',
          action: 'PDF_JOB_CANCELLED',
          fromStatus: job.status,
          toStatus: 'FAILED',
          note: `Job compilation cancelled by user. Refunded ${refundedCredits} credits.`,
        },
      });

      return { success: true, refundedCredits };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Cancel PDF job error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
