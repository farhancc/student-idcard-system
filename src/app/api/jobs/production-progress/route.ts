import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);

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

    const updatedJob = await prisma.pdfJob.update({
      where: { id: job.id },
      data: {
        progress: progress !== undefined ? Number(progress) : job.progress,
        status: status || job.status,
      },
    });

    return NextResponse.json({ success: true, job: updatedJob });
  } catch (error) {
    console.error('Update PDF job progress error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
