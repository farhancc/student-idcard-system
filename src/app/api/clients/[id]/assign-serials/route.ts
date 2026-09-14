import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { assignSerialNumber } from '@/lib/serials';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
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

    const cleanPrefix = prefix.trim().toUpperCase();
    const padding = padLen ? Number(padLen) : 4;
    const count = cardholders.length;

    const assigned = await prisma.$transaction(async (tx) => {
      // 1. Get or create counter and increment by count
      let ctr = await tx.cardSerialCounter.findUnique({
        where: {
          pressId_clientId_prefix: {
            pressId,
            clientId,
            prefix: cleanPrefix,
          },
        },
      });

      if (!ctr) {
        ctr = await tx.cardSerialCounter.create({
          data: {
            pressId,
            clientId,
            prefix: cleanPrefix,
            lastSeq: 0,
            padLen: padding,
          },
        });
      }

      const startSeq = ctr.lastSeq + 1;
      await tx.cardSerialCounter.update({
        where: { id: ctr.id },
        data: { lastSeq: { increment: count } },
      });

      const serials: string[] = [];
      const cardholderIds: number[] = [];

      for (let i = 0; i < count; i++) {
        const seqNum = startSeq + i;
        const paddedSeq = String(seqNum).padStart(padding, '0');
        const serial = `${cleanPrefix}-${paddedSeq}`;
        serials.push(serial);

        const ch = cardholders[i];
        cardholderIds.push(ch.id);
      }

      await Promise.all(cardholders.map((ch, i) => tx.cardholder.update({
        where: { id: ch.id },
        data: { cardSerial: serials[i] },
      })));

      // Mark card assets stale in 1 batch query
      await tx.cardAsset.updateMany({
        where: { cardholderId: { in: cardholderIds } },
        data: { isStale: true },
      });

      return serials;
    });

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
