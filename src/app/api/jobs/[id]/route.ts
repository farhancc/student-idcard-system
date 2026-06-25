import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Check if the link has expired (R5)
    let isExpired = false;
    if (job.expiresAt && new Date() > job.expiresAt) {
      isExpired = true;
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        pdfType: job.pdfType,
        status: job.status,
        progress: job.progress,
        fileName: job.fileName,
        errorMsg: job.errorMsg,
        downloadUrl: isExpired ? null : `/api/jobs/${jobId}/download`, // Point to secure logged download route
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
