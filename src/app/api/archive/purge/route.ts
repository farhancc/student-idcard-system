import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

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

function getCloudinaryPublicId(url: string): string | null {
  if (!url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathPart = parts[1]; // e.g. v12345/press_1/photos/abcdef.jpg
    const pathSegments = pathPart.split('/');
    // Skip version if it starts with 'v' followed by digits
    const startIndex = pathSegments[0].startsWith('v') && !isNaN(Number(pathSegments[0].substring(1))) ? 1 : 0;
    const relativePath = pathSegments.slice(startIndex).join('/'); // press_1/photos/abcdef.jpg
    const publicId = relativePath.substring(0, relativePath.lastIndexOf('.')); // press_1/photos/abcdef
    return publicId;
  } catch (err) {
    console.error('Failed to parse Cloudinary URL:', err);
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

    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid IDs' }, { status: 400 });
    }

    // Fetch matching cardholders for this press (safety)
    const cardholders = await prisma.cardholder.findMany({
      where: {
        id: { in: ids },
        pressId,
      },
      select: {
        id: true,
        photoUrl: true,
      },
    });

    const targetIds = cardholders.map(ch => ch.id);
    if (targetIds.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    let deletedPhotosCount = 0;

    // Destroy associated photos in Cloudinary if configured
    if (isCloudinaryConfigured) {
      for (const ch of cardholders) {
        if (ch.photoUrl) {
          const publicId = getCloudinaryPublicId(ch.photoUrl);
          if (publicId) {
            try {
              await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
              deletedPhotosCount++;
            } catch (cloudErr) {
              console.error(`Failed to delete Cloudinary photo for cardholder #${ch.id}:`, cloudErr);
            }
          }
        }
      }
    }

    // Delete cardholders from DB
    const deleteResult = await prisma.cardholder.deleteMany({
      where: {
        id: { in: targetIds },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count,
      deletedPhotos: deletedPhotosCount,
    });
  } catch (error: any) {
    console.error('Purge archived cardholders error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
