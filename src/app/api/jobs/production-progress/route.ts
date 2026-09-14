import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const { jobId, progress, status } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const job = await prisma.pdfJob.findFirst({
      where: { id: Number(jobId), pressId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let targetStatus = status || job.status;
    if (targetStatus === 'COMPLETED' || targetStatus === 'FAILED') {
      targetStatus = 'PROCESSING';
    }

    const updatedJob = await prisma.pdfJob.update({
      where: { id: job.id },
      data: {
        progress: progress !== undefined ? Number(progress) : job.progress,
        status: targetStatus,
      },
    });

    return NextResponse.json({ success: true, job: updatedJob });
  } catch (error) {
    console.error('Update PDF job progress error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
