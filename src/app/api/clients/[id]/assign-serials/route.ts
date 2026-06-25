import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assignSerialNumber } from '@/lib/serials';

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
    const clientId = Number(id);

    const { prefix, padLen } = await request.json();

    if (!prefix) {
      return NextResponse.json({ error: 'Prefix is required' }, { status: 400 });
    }

    // Verify client
    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Find cardholders without a serial
    const cardholders = await prisma.cardholder.findMany({
      where: { clientId, cardSerial: null },
      orderBy: { id: 'asc' }, // Allocate in order of creation
    });

    if (cardholders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All cardholders already have serial numbers.',
        assignedCount: 0,
      });
    }

    const assigned: string[] = [];

    // Loop and assign serials sequentially
    for (const cardholder of cardholders) {
      const serial = await assignSerialNumber(pressId, clientId, prefix, padLen ? Number(padLen) : 4);
      await prisma.cardholder.update({
        where: { id: cardholder.id },
        data: { cardSerial: serial },
      });
      // Mark card asset stale
      await prisma.cardAsset.updateMany({
        where: { cardholderId: cardholder.id },
        data: { isStale: true },
      });
      assigned.push(serial);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${assigned.length} serial numbers.`,
      assignedCount: assigned.length,
      assignedSerials: assigned,
    });
  } catch (error) {
    console.error('Assign serials error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
