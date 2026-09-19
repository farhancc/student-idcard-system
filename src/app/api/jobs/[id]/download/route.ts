import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl, validateSignedUrl } from '@/lib/signed-url';
import { requireActor } from '@/lib/authz';
import fs from 'fs';
import path from 'path';

/**
 * `existsSync` followed by `readFileSync` is a check-then-use race — the
 * resolved path can also be a directory (e.g. a bare "/tmp"), which passes
 * the existence check and then throws EISDIR on read. Collapse both into one
 * operation so any failure (missing, deleted between check and read, not a
 * regular file, no permission) is treated as "not found" instead of
 * crashing the request with a 500.
 */
function readFileIfExists(filePath: string): Buffer | null {
  try {
    if (!fs.statSync(filePath).isFile()) return null;
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId, userId } = auth.actor;
    const { id } = await params;
    const jobId = Number(id);

    // 1. Fetch PDF job
    const job = await prisma.pdfJob.findFirst({
      where: { id: jobId, pressId },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!job || job.status !== 'COMPLETED') {
      return new Response('PDF file is not available or generation failed.', { status: 404 });
    }

    // 2. Check if link has expired (R5)
    if (job.expiresAt && new Date() > job.expiresAt) {
      return new Response('This download link has expired. PDF jobs expire 7 days after generation.', { status: 410 });
    }

    // Handle multi-part chunk downloads
    const chunkParam = new URL(request.url).searchParams.get('chunk');
    if (job.chunks && job.chunks.length > 0) {
      if (chunkParam !== null) {
        const chunkIdx = Number(chunkParam);
        const chunk = job.chunks.find((c: any) => c.chunkIndex === chunkIdx);
        if (!chunk || !chunk.downloadUrl) {
          return new Response('Chunk not found.', { status: 404 });
        }
        // Redirect to the chunk's download URL or serve it
        if (chunk.downloadUrl.startsWith('http')) {
          return NextResponse.redirect(chunk.downloadUrl, { status: 302 });
        }
        // Serve local chunk file
        const chunkPath = chunk.downloadUrl.replace(/^\//, '');
        const tmpPath = path.join('/tmp', 'idexo', chunkPath);
        const publicPath = path.join(process.cwd(), 'public', chunkPath);
        const chunkBuffer = readFileIfExists(tmpPath) ?? readFileIfExists(publicPath);
        if (!chunkBuffer) return new Response('Chunk file not found on server.', { status: 404 });
        return new Response(chunkBuffer as any, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${chunk.fileName}"`,
            'Content-Length': String(chunkBuffer.length),
            'Cache-Control': 'private, no-store',
          },
        });
      } else {
        // Return JSON listing all chunks
        return NextResponse.json({
          multiPart: true,
          chunkCount: job.chunks.length,
          chunks: job.chunks.map((c: any) => ({
            chunkIndex: c.chunkIndex,
            fileName: c.fileName,
            downloadUrl: `/api/jobs/${jobId}/download?chunk=${c.chunkIndex}`,
          })),
        });
      }
    }

    if (!job.downloadUrl) {
      return new Response('PDF file is not available.', { status: 404 });
    }

    // 3. Resolve and serve file
    let fileBuffer: Buffer;

    if (job.downloadUrl.startsWith('http') && job.downloadUrl.includes('cloudinary.com')) {
      // Cloudinary asset: redirect to a fresh signed URL
      const signedUrl = generateSignedUrl(job.downloadUrl);
      const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
      await prisma.pdfDownloadLog.create({
        data: { pdfJobId: jobId, pressId, downloadedBy: userId, ipAddress },
      });
      return NextResponse.redirect(signedUrl, { status: 302 });

    } else if (job.downloadUrl.startsWith('http')) {
      // Other remote URL: validate signed token if present
      const { searchParams } = new URL(request.url);
      const sig = searchParams.get('sig');
      const exp = searchParams.get('exp');
      if (sig && exp && !validateSignedUrl(job.downloadUrl, sig, exp)) {
        return new Response('Download link has expired or is invalid.', { status: 403 });
      }
      const res = await fetch(job.downloadUrl);
      if (!res.ok) return new Response('PDF file was not found on remote storage.', { status: 404 });
      fileBuffer = Buffer.from(await res.arrayBuffer());

    } else {
      // Local file: validate HMAC signed token
      const { searchParams } = new URL(request.url);
      const sig = searchParams.get('sig');
      const exp = searchParams.get('exp');
      const isDev = process.env.NODE_ENV === 'development';
      const hasSigningSecret = !!(process.env.SIGNED_URL_SECRET || process.env.NEXTAUTH_SECRET);

      if (!isDev || hasSigningSecret) {
        if (!sig || !exp) {
          return new Response('Missing download authorization token.', { status: 403 });
        }
        if (!validateSignedUrl(job.downloadUrl, sig, exp)) {
          return new Response('Download link has expired or is invalid.', { status: 403 });
        }
      }

      let localBuffer: Buffer | null = null;

      if (job.downloadUrl.startsWith('local://')) {
        let urlPath = job.downloadUrl.replace(/^local:\/\//i, '').split('?')[0].split('#')[0];
        try { urlPath = decodeURIComponent(urlPath); } catch (e) {}
        if (process.platform === 'win32') {
          if (urlPath.startsWith('/')) urlPath = urlPath.slice(1);
        } else {
          if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
        }
        localBuffer = readFileIfExists(urlPath);
      }

      if (!localBuffer) {
        const relativePath = job.downloadUrl.replace(/^\//, '');
        const tmpPath = path.join('/tmp', 'idexo', relativePath);
        const publicPath = path.join(process.cwd(), 'public', relativePath);
        localBuffer = readFileIfExists(tmpPath) ?? readFileIfExists(publicPath);
      }

      if (!localBuffer) return new Response('PDF file was not found on server storage.', { status: 404 });
      fileBuffer = localBuffer;
    }

    // 4. Log download event
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await prisma.pdfDownloadLog.create({
      data: { pdfJobId: jobId, pressId, downloadedBy: userId, ipAddress },
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
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Download PDF error:', error);
    return new Response('Internal server error serving PDF', { status: 500 });
  }
}
