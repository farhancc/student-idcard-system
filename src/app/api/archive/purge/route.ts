import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { deleteFromR2 } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

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

    // Delete associated photos from R2 / storage
    for (const ch of cardholders) {
      if (ch.photoUrl) {
        const deleted = await deleteFromR2(ch.photoUrl);
        if (deleted) deletedPhotosCount++;
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
  } catch (error: unknown) {
    console.error('Purge archived cardholders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
