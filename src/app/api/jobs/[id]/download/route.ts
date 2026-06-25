import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');

    if (!pressIdStr || !userIdStr) {
      return new Response('Unauthorized session', { status: 401 });
    }

    const pressId = Number(pressIdStr);
    const userId = Number(userIdStr);
    const { id } = await params;
    const jobId = Number(id);

    // 1. Fetch PDF job
    const job = await prisma.pdfJob.findFirst({
      where: { id: jobId, pressId },
    });

    if (!job || job.status !== 'COMPLETED' || !job.downloadUrl) {
      return new Response('PDF file is not available or generation failed.', { status: 404 });
    }

    // 2. Check if link has expired (R5)
    if (job.expiresAt && new Date() > job.expiresAt) {
      return new Response('This download link has expired. PDF jobs expire 7 days after generation.', { status: 410 });
    }

    // 3. Resolve absolute path or fetch from remote URL
    let fileBuffer: Buffer;

    if (job.downloadUrl.startsWith('http')) {
      const res = await fetch(job.downloadUrl);
      if (!res.ok) {
        return new Response('PDF file was not found on remote storage.', { status: 404 });
      }
      const arrayBuffer = await res.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      const relativePath = job.downloadUrl.replace(/^\//, ''); // strip leading slash
      
      // Check /tmp first (production writeable folder), then fallback to public/uploads
      const tmpPath = path.join('/tmp', 'idexo', relativePath);
      const publicPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', relativePath);

      let finalPath = '';
      if (fs.existsSync(tmpPath)) {
        finalPath = tmpPath;
      } else if (fs.existsSync(publicPath)) {
        finalPath = publicPath;
      } else {
        return new Response('PDF file was not found on server storage.', { status: 404 });
      }

      fileBuffer = fs.readFileSync(finalPath);
    }

    // 4. Log Download event (R4)
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';

    await prisma.pdfDownloadLog.create({
      data: {
        pdfJobId: jobId,
        pressId,
        downloadedBy: userId,
        ipAddress,
      },
    });

    const { searchParams } = new URL(request.url);
    const inline = searchParams.get('inline') === 'true';

    return new Response(fileBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': inline
          ? `inline; filename="${job.fileName}"`
          : `attachment; filename="${job.fileName}"`,
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (error) {
    console.error('Download PDF error:', error);
    return new Response('Internal server error serving PDF', { status: 500 });
  }
}
