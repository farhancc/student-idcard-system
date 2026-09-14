import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { deleteFromR2 } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

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
    for (const ch of cardholders) {
      if (ch.photoUrl) {
        const ok = await deleteFromR2(ch.photoUrl);
        if (ok) deletedPhotos++;
      }
    }

    // 2. Fetch PDF Jobs to delete from storage
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
    for (const job of pdfJobs) {
      if (job.downloadUrl) {
        const ok = await deleteFromR2(job.downloadUrl);
        if (ok) deletedPdfs++;
      }
    }

    // 3. Delete cardholders
    const deletedCardholdersRes = await prisma.cardholder.deleteMany({
      where: {
        clientId: { in: clientIds },
        pressId,
        createdAt: { lte: endDate }
      }
    });

    // 4. Delete orders
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
      deletedPhotosStorage: deletedPhotos,
      deletedPdfsStorage: deletedPdfs
    });
  } catch (error: unknown) {
    console.error('Backup purge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
