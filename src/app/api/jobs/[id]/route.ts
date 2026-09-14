import { NextResponse } from 'next/server';
import { requireActor, requireRole } from '@/lib/authz';
import { writeAuditLog, getActorFromRequest, AuditActions } from '@/lib/audit-log';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl } from '@/lib/signed-url';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const orgToken = searchParams.get('orgToken');
    let pressId: number;

    if (orgToken) {
      const share = await prisma.clientPortalShare.findUnique({
        where: { orgToken },
      });
      if (!share || !share.active) {
        return NextResponse.json({ error: 'Unauthorized or invalid portal link' }, { status: 403 });
      }
      pressId = share.pressId;
    } else {
      const auth = requireActor(request);
      if ('response' in auth) return auth.response;
      pressId = auth.actor.pressId;
    }
    const { id } = await params;
    const jobId = Number(id);

    const job = await prisma.pdfJob.findFirst({
      where: { id: jobId, pressId },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
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
        chunkCount: job.chunks.length > 0 ? job.chunks.length : undefined,
        chunks: job.chunks.length > 0 ? job.chunks.map((c: any) => ({
          chunkIndex: c.chunkIndex,
          fileName: c.fileName,
          downloadUrl: c.downloadUrl,
        })) : undefined,
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
    // Cancelling refunds credits to the press — a credit movement.
    const auth = requireRole(request, ['OWNER', 'OPERATOR']);
    if ('response' in auth) return auth.response;
    const { pressId, userId } = auth.actor;
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

    if (result.refundedCredits > 0) {
      void writeAuditLog({
        ...getActorFromRequest(request),
        action: AuditActions.CREDITS_REFUNDED,
        category: 'BILLING',
        resourceType: 'PdfJob',
        resourceId: jobId,
        description: `Cancelled job ${jobId}, refunded ${result.refundedCredits} credits`,
        newValue: { refundedCredits: result.refundedCredits },
      });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Cancel PDF job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
