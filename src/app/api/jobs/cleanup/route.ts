import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    // Destructive and irreversible: restrict to the tenant owner.
    // Superseded by the scheduled /api/cron/cleanup — delete this route once
    // that job is running (see REMEDIATION_PLAN.md item 2.2).
    const pressId = request.headers.get('x-press-id');
    const role = request.headers.get('x-user-role');
    if (!pressId || !role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden: owners only' }, { status: 403 });
    }

    const now = new Date();

    // 1. Fetch expired jobs
    const expiredJobs = await prisma.pdfJob.findMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    let deletedFilesCount = 0;
    let deletedRecordsCount = 0;

    for (const job of expiredJobs) {
      if (job.downloadUrl) {
        if (job.downloadUrl.startsWith('http')) {
          const isCloudinaryConfigured = 
            process.env.CLOUDINARY_CLOUD_NAME && 
            process.env.CLOUDINARY_API_KEY && 
            process.env.CLOUDINARY_API_SECRET;

          if (isCloudinaryConfigured) {
            try {
              const { v2: cloudinary } = require('cloudinary');
              cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
              });

              const publicId = `press_${job.pressId}/pdfs/${job.fileName.replace('.pdf', '')}`;
              await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
              deletedFilesCount++;
            } catch (cloudErr) {
              console.error(`Failed to delete Cloudinary file for job #${job.id}:`, cloudErr);
            }
          }
        } else if (!job.downloadUrl.startsWith('local://')) {
          // Construct local file path from relative downloadUrl
          // e.g. downloadUrl = /uploads/{pressId}/pdfs/{fileName}.pdf
          const relativePath = job.downloadUrl.replace(/^\//, '');
          const tmpPath = path.join('/tmp', 'idexo', relativePath);
          const publicPath = path.join(process.cwd(), 'public', relativePath);

          try {
            if (fs.existsSync(tmpPath)) {
              fs.unlinkSync(tmpPath);
              deletedFilesCount++;
            } else if (fs.existsSync(publicPath)) {
              fs.unlinkSync(publicPath);
              deletedFilesCount++;
            }
          } catch (fileErr) {
            console.error(`Failed to delete expired file ${job.downloadUrl}:`, fileErr);
          }
        }
      }
    }

    // Batch delete all expired job records in a single DB query
    const expiredJobIds = expiredJobs.map(j => j.id);
    if (expiredJobIds.length > 0) {
      const deleteResult = await prisma.pdfJob.deleteMany({
        where: { id: { in: expiredJobIds } },
      });
      deletedRecordsCount = deleteResult.count;
    }

    return NextResponse.json({
      success: true,
      message: 'Cleanup job completed successfully.',
      expiredJobsFound: expiredJobs.length,
      deletedFiles: deletedFilesCount,
      deletedDbRecords: deletedRecordsCount,
    });
  } catch (error) {
    console.error('Job retention cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error during cleanup' }, { status: 500 });
  }
}
