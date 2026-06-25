import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    // Optional: Protect cron route using token or simple signature check
    // In this basic version, we allow running it via post request.

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
        } else {
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

      // Delete job record from database
      await prisma.pdfJob.delete({
        where: { id: job.id },
      });
      deletedRecordsCount++;
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
