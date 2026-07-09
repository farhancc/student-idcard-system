import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

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

function getCloudinaryPublicId(url: string): string | null {
  if (!url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathPart = parts[1];
    const pathSegments = pathPart.split('/');
    const startIndex = pathSegments[0].startsWith('v') && !isNaN(Number(pathSegments[0].substring(1))) ? 1 : 0;
    const relativePath = pathSegments.slice(startIndex).join('/');
    return relativePath.substring(0, relativePath.lastIndexOf('.'));
  } catch (err) {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const { year, month, clientIds } = await request.json();
    if (!year || !month || !clientIds || !Array.isArray(clientIds)) {
      return NextResponse.json({ error: 'Missing year, month, or clientIds' }, { status: 400 });
    }

    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // 1. Fetch cardholders to delete photos
    const cardholders = await prisma.cardholder.findMany({
      where: {
        clientId: { in: clientIds },
        pressId,
        createdAt: { lte: endDate }
      },
      select: {
        id: true,
        photoUrl: true
      }
    });

    let deletedPhotos = 0;
    if (isCloudinaryConfigured) {
      for (const ch of cardholders) {
        if (ch.photoUrl) {
          const publicId = getCloudinaryPublicId(ch.photoUrl);
          if (publicId) {
            try {
              await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
              deletedPhotos++;
            } catch (err) {
              console.error(`Failed to destroy Cloudinary photo for cardholder ${ch.id}:`, err);
            }
          }
        }
      }
    }

    // 2. Fetch PDF Jobs to delete from Cloudinary
    const pdfJobs = await prisma.pdfJob.findMany({
      where: {
        order: {
          clientId: { in: clientIds },
          pressId,
          createdAt: { lte: endDate }
        }
      },
      select: {
        id: true,
        pressId: true,
        fileName: true,
        downloadUrl: true
      }
    });

    let deletedPdfs = 0;
    if (isCloudinaryConfigured) {
      for (const job of pdfJobs) {
        if (job.downloadUrl && job.downloadUrl.startsWith('http')) {
          try {
            const publicId = `press_${job.pressId}/pdfs/${job.fileName.replace('.pdf', '')}`;
            await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            deletedPdfs++;
          } catch (err) {
            console.error(`Failed to destroy Cloudinary PDF for job ${job.id}:`, err);
          }
        }
      }
    }

    // 3. Delete cardholders (cascades to cardAsset, printRecords, orderCardholders join table)
    const deletedCardholdersRes = await prisma.cardholder.deleteMany({
      where: {
        clientId: { in: clientIds },
        pressId,
        createdAt: { lte: endDate }
      }
    });

    // 4. Delete orders (cascades to pdfJobs, invoices, activities, notes, delivery records, etc.)
    const deletedOrdersRes = await prisma.cardOrder.deleteMany({
      where: {
        clientId: { in: clientIds },
        pressId,
        createdAt: { lte: endDate }
      }
    });

    return NextResponse.json({
      success: true,
      deletedCardholdersCount: deletedCardholdersRes.count,
      deletedOrdersCount: deletedOrdersRes.count,
      deletedPhotosCloudinary: deletedPhotos,
      deletedPdfsCloudinary: deletedPdfs
    });
  } catch (error: any) {
    console.error('Backup purge error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
