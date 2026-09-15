import { NextResponse } from 'next/server';
import { prisma, withSystemContext } from '@/lib/prisma';
import { deleteManyFromR2, isR2Configured } from '@/lib/storage';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Configure Cloudinary if environment variables are set
const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/** Verify CRON_SECRET using constant-time comparison to prevent timing attacks. */
function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const expected = `Bearer ${cronSecret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function handleCleanup(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withSystemContext(async () => {
    try {
    const now = new Date();
    
    // Find all jobs that have expired or are older than 30 days
    const expiredJobs = await prisma.pdfJob.findMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { completedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
        ]
      },
      select: {
        id: true,
        downloadUrl: true,
        pdfType: true,
        pressId: true
      }
    });

    if (expiredJobs.length === 0) {
      return NextResponse.json({ success: true, message: 'No expired PDF jobs to clean up.' });
    }

    let deletedFilesCount = 0;
    let failedDeletionsCount = 0;

    // R2-hosted job files, plus every chunk of a chunked job, go in one batched
    // delete. Until this was added nothing ever removed them from R2: the DB
    // rows were dropped (chunks by cascade) and the objects were orphaned.
    const chunks = await prisma.pdfJobChunk.findMany({
      where: { pdfJobId: { in: expiredJobs.map((j: { id: number }) => j.id) } },
      select: { downloadUrl: true },
    });
    const r2Urls = [
      ...expiredJobs.map((j: { downloadUrl: string | null }) => j.downloadUrl),
      ...chunks.map((c: { downloadUrl: string | null }) => c.downloadUrl),
    ].filter((url: string | null): url is string => Boolean(url) && !url!.includes('cloudinary.com'));

    if (isR2Configured) {
      const r2Result = await deleteManyFromR2(r2Urls);
      deletedFilesCount += r2Result.deleted;
      failedDeletionsCount += r2Result.failed.length;
    }

    for (const job of expiredJobs) {
      if (!job.downloadUrl) continue;

      if (isCloudinaryConfigured && job.downloadUrl.includes('cloudinary.com')) {
        // Delete from Cloudinary
        try {
          // Extract public ID for raw files (PDFs)
          // URL format: https://res.cloudinary.com/<cloud_name>/raw/upload/<version>/press_<pressId>/pdfs/<filename>.pdf
          const parts = job.downloadUrl.split('/upload/');
          if (parts.length >= 2) {
            const pathPart = parts[1];
            const segments = pathPart.split('/');
            const startIndex = segments[0].startsWith('v') && !isNaN(Number(segments[0].substring(1))) ? 1 : 0;
            const relativePath = segments.slice(startIndex).join('/');
            // For raw files, Cloudinary needs the full relative path including extension as the public_id
            await cloudinary.uploader.destroy(relativePath, { resource_type: 'raw' });
            deletedFilesCount++;
          }
        } catch (err) {
          console.error(`Failed to delete Cloudinary asset for job #${job.id}:`, err);
          failedDeletionsCount++;
        }
      } else if (!job.downloadUrl.startsWith('local://') && !isR2Configured) {
        // Delete from local filesystem. Only reached when R2 is unconfigured:
        // otherwise the batched delete above already removed this object, and
        // this branch resolves a different path layout than the R2 fallback.
        try {
          const isProd = process.env.VERCEL || process.env.NODE_ENV === 'production';
          const fileName = path.basename(job.downloadUrl);
          const pdfDir = isProd
            ? path.join('/tmp', 'idexo', String(job.pressId), 'pdfs')
            : path.join(process.cwd(), 'public', 'uploads', String(job.pressId), 'pdfs');
          const filePath = path.join(pdfDir, fileName);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFilesCount++;
          }
        } catch (err) {
          console.error(`Failed to delete local file for job #${job.id}:`, err);
          failedDeletionsCount++;
        }
      }
    }

    // Delete the jobs from the database
    const jobIds = expiredJobs.map(j => j.id);
    const deleteResult = await prisma.pdfJob.deleteMany({
      where: {
        id: { in: jobIds }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up expired PDF jobs.`,
      jobsDeleted: deleteResult.count,
      filesDeleted: deletedFilesCount,
      failedDeletions: failedDeletionsCount
    });
  } catch (error: unknown) {
    console.error('Expired PDF cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  });
}

// Vercel cron sends GET requests
export async function GET(request: Request) {
  return handleCleanup(request);
}

export async function POST(request: Request) {
  return handleCleanup(request);
}

