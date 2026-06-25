import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const cardholderId = Number(id);

    const { remarks, orderId } = await request.json();

    // Verify cardholder exists
    const cardholder = await prisma.cardholder.findFirst({
      where: { id: cardholderId, pressId },
    });
    if (!cardholder) {
      return NextResponse.json({ error: 'Cardholder not found' }, { status: 404 });
    }

    // Insert a new print record tracking that this card is LOST
    const record = await prisma.cardPrintRecord.create({
      data: {
        cardholderId,
        pressId,
        orderId: orderId ? Number(orderId) : 0, // Fallback if no specific order is attached
        status: 'LOST',
        remarks: remarks || 'Card reported lost or damaged.',
      },
    });

    // Also mark the CardAsset stale so that if they reprint, it re-renders fresh details
    await prisma.cardAsset.updateMany({
      where: { cardholderId },
      data: { isStale: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Card reported as LOST. Print asset marked stale for reprint.',
      record,
    });
  } catch (error) {
    console.error('Report card lost error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
