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
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathPart = parts[1];
    const pathSegments = pathPart.split('/');
    const startIndex = pathSegments[0].startsWith('v') && !isNaN(Number(pathSegments[0].substring(1))) ? 1 : 0;
    const relativePath = pathSegments.slice(startIndex).join('/');
    return relativePath.substring(0, relativePath.lastIndexOf('.'));
  } catch {
    return null;
  }
}

/**
 * DELETE /api/superadmin/presses/[id]
 * Hard deletes a press and ALL associated users, clients, cardholders, orders,
 * templates, portal shares, fonts, and Cloudinary media assets permanently.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pressId = Number(id);

    if (isNaN(pressId)) {
      return NextResponse.json({ error: 'Invalid Press ID' }, { status: 400 });
    }

    const press = await prisma.press.findUnique({
      where: { id: pressId },
      select: { id: true, name: true, email: true },
    });

    if (!press) {
      return NextResponse.json({ error: 'Press not found' }, { status: 404 });
    }

    // 1. Clean up Cloudinary assets if configured
    if (isCloudinaryConfigured) {
      try {
        const cardholders = await prisma.cardholder.findMany({
          where: { pressId },
          select: { photoUrl: true },
        });

        for (const ch of cardholders) {
          if (ch.photoUrl) {
            const pubId = getCloudinaryPublicId(ch.photoUrl);
            if (pubId) {
              await cloudinary.uploader.destroy(pubId, { resource_type: 'image' }).catch(() => {});
            }
          }
        }

        await cloudinary.api.delete_resources_by_prefix(`press_${pressId}/`, { resource_type: 'raw' }).catch(() => {});
        await cloudinary.api.delete_resources_by_prefix(`press_${pressId}/`, { resource_type: 'image' }).catch(() => {});
      } catch (cloudErr) {
        console.error('Cloudinary cleanup warning during hard delete:', cloudErr);
      }
    }

    // 2. Perform Transactional Hard Delete in DB
    await prisma.$transaction(async (tx) => {
      // Delete portal shares first
      await tx.clientPortalShare.deleteMany({
        where: { pressId },
      });

      // Hard Delete the Press (Cascades to PressUser, Client, Cardholder, CardOrder, OrderInvoice, CardTemplate, PdfJob, etc.)
      await tx.press.delete({
        where: { id: pressId },
      });

      // Audit Log
      await tx.systemAuditLog.create({
        data: {
          pressId: null,
          actorType: 'SUPER_ADMIN',
          actorName: 'Super Admin',
          action: 'HARD_DELETE_PRESS',
          category: 'USER',
          resourceType: 'Press',
          resourceId: String(pressId),
          description: `Permanently hard deleted Press "${press.name}" (${press.email}) and all associated records.`,
          ipAddress: '127.0.0.1',
          severity: 'CRITICAL',
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Press "${press.name}" and all associated records have been hard deleted permanently.`,
    });
  } catch (error: any) {
    console.error('Superadmin hard delete press error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
