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

export async function POST(request: Request) {
  try {
    const pressId = await getPressIdFromApiKey(request);
    if (!pressId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, name, designation, photoUrl, customFields, uniqueKey } = body;

    if (!clientId || !name) {
      return NextResponse.json({ error: 'Missing clientID or name' }, { status: 400 });
    }

    // Verify client belongs to this press
    const client = await prisma.client.findFirst({
      where: { id: Number(clientId), pressId },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    // Fold uniqueKey into customFields if provided
    const custom = customFields || {};
    if (uniqueKey && !custom.uniqueKey && !custom.id && !custom.unique_key) {
      custom.uniqueKey = uniqueKey;
    }

    // Check duplicate
    const duplicate = await prisma.cardholder.findFirst({
      where: { clientId: Number(clientId), name, designation: designation ?? null },
    });
    if (duplicate) {
      return NextResponse.json({ error: `Cardholder "${name}" with designation "${designation || ''}" already exists.` }, { status: 409 });
    }

    // Create
    const cardholder = await prisma.cardholder.create({
      data: {
        pressId,
        clientId: Number(clientId),
        name,
        designation,
        photoUrl,
        customFields: Object.keys(custom).length > 0 ? JSON.stringify(custom) : null,
      },
    });

    return NextResponse.json({ success: true, cardholder });
  } catch (error) {
    console.error('REST create cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
