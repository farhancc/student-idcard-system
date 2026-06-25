import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

async function getPressIdFromApiKey(request: Request): Promise<number | null> {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!apiKey) return null;

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyRecord = await prisma.pressApiKey.findUnique({
    where: { keyHash },
  });

  if (!keyRecord) return null;

  // Track usage
  await prisma.pressApiKey.update({
    where: { id: keyRecord.id },
    data: { lastUsed: new Date() },
  });

  return keyRecord.pressId;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressId = await getPressIdFromApiKey(request);
    if (!pressId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const { id } = await params;
    const cardholderId = Number(id);
    const body = await request.json();
    const { name, designation, photoUrl, customFields, uniqueKey, active } = body;

    const cardholder = await prisma.cardholder.findFirst({
      where: { id: cardholderId, pressId },
    });

    if (!cardholder) {
      return NextResponse.json({ error: 'Cardholder not found or access denied' }, { status: 404 });
    }

    const updated = await prisma.cardholder.update({
      where: { id: cardholderId },
      data: {
        name: name !== undefined ? name : cardholder.name,
        designation: designation !== undefined ? designation : cardholder.designation,
        photoUrl: photoUrl !== undefined ? photoUrl : cardholder.photoUrl,
        customFields: customFields !== undefined ? (customFields ? JSON.stringify(customFields) : null) : cardholder.customFields,
        uniqueKey: uniqueKey !== undefined ? uniqueKey : cardholder.uniqueKey,
        active: active !== undefined ? active : cardholder.active,
      },
    });

    // Mark cache stale if data changed
    if (
      name !== cardholder.name ||
      designation !== cardholder.designation ||
      photoUrl !== cardholder.photoUrl ||
      JSON.stringify(customFields) !== cardholder.customFields
    ) {
      await prisma.cardAsset.updateMany({
        where: { cardholderId },
        data: { isStale: true },
      });
    }

    return NextResponse.json({ success: true, cardholder: updated });
  } catch (error) {
    console.error('REST update cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressId = await getPressIdFromApiKey(request);
    if (!pressId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const { id } = await params;
    const cardholderId = Number(id);

    const cardholder = await prisma.cardholder.findFirst({
      where: { id: cardholderId, pressId },
    });

    if (!cardholder) {
      return NextResponse.json({ error: 'Cardholder not found or access denied' }, { status: 404 });
    }

    await prisma.cardholder.delete({
      where: { id: cardholderId },
    });

    return NextResponse.json({ success: true, message: 'Cardholder deleted successfully' });
  } catch (error) {
    console.error('REST delete cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
