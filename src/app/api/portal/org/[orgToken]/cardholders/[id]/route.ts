import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orgToken: string; id: string }> }
) {
  try {
    const { orgToken, id: cardholderIdStr } = await params;
    const cardholderId = Number(cardholderIdStr);

    const share = await prisma.clientPortalShare.findUnique({
      where: { orgToken },
    });

    if (!share || !share.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const cardholder = await prisma.cardholder.findFirst({
      where: { id: cardholderId, clientId: share.clientId },
    });

    if (!cardholder) {
      return NextResponse.json({ error: 'Cardholder not found' }, { status: 404 });
    }

    const { name, designation, photoUrl, customFields, uniqueKey } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check unique key constraint if changed
    if (uniqueKey && uniqueKey !== cardholder.uniqueKey) {
      const existing = await prisma.cardholder.findFirst({
        where: { clientId: share.clientId, uniqueKey },
      });
      if (existing) {
        return NextResponse.json({ error: `Cardholder with Unique Key/Roll Number '${uniqueKey}' already exists.` }, { status: 400 });
      }
    }

    // Update the cardholder details
    const updated = await prisma.cardholder.update({
      where: { id: cardholderId },
      data: {
        name,
        designation,
        photoUrl,
        customFields: typeof customFields === 'string' ? customFields : JSON.stringify(customFields || {}),
        uniqueKey,
        cardSerial: uniqueKey || cardholder.cardSerial,
      },
    });

    // Mark cache as stale to force a re-render of PDF/PNG assets
    await prisma.cardAsset.updateMany({
      where: { cardholderId },
      data: { isStale: true },
    });

    return NextResponse.json({ success: true, cardholder: updated });
  } catch (error) {
    console.error('Portal update cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgToken: string; id: string }> }
) {
  try {
    const { orgToken, id: cardholderIdStr } = await params;
    const cardholderId = Number(cardholderIdStr);

    const share = await prisma.clientPortalShare.findUnique({
      where: { orgToken },
    });

    if (!share || !share.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    // Delete the cardholder
    await prisma.cardholder.delete({
      where: { id: cardholderId, clientId: share.clientId },
    });

    return NextResponse.json({ success: true, message: 'Cardholder deleted successfully' });
  } catch (error) {
    console.error('Portal delete cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
