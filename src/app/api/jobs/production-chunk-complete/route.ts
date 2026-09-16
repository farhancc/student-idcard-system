import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const chunkCompleteSchema = z.object({
  jobId: z.union([z.number(), z.string().transform(Number)]),
  chunkIndex: z.number(),
  totalChunks: z.number(),
  localPath: z.string().optional(),
  fileName: z.string(),
});

export async function POST(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const validation = chunkCompleteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request parameters', details: validation.error.format() }, { status: 400 });
    }

    const { jobId, chunkIndex, totalChunks, localPath, fileName } = validation.data;

    // Verify the job belongs to this press
    const job = await prisma.pdfJob.findFirst({
      where: { id: Number(jobId), pressId },
    });
    if (!job) {
      return NextResponse.json({ error: 'PDF Job not found' }, { status: 404 });
    }

    // The chunk's bytes follow on PUT /api/jobs/[id]/pdf?chunk=N, which fills in
    // downloadUrl and fileSize if it manages to store them. Until then the
    // operator's own saved file is where this chunk lives.
    let downloadUrl = '';
    if (localPath) {
      const formattedPath = localPath.replace(/\\/g, '/');
      const prefix = (formattedPath.startsWith('/') || !/^[a-zA-Z]:/.test(formattedPath)) ? '' : '/';
      downloadUrl = `local://${prefix}${formattedPath}`;
    }

    // Create the chunk record
    const chunk = await prisma.pdfJobChunk.create({
      data: {
        pdfJobId: Number(jobId),
        chunkIndex,
        totalChunks,
        fileName,
        downloadUrl: downloadUrl || null,
        localPath: localPath || null,
        fileSize: null,
      },
    });

    return NextResponse.json({
      success: true,
      chunkId: chunk.id,
      chunkIndex,
      downloadUrl,
    });
  } catch (error: unknown) {
    console.error('Chunk complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
