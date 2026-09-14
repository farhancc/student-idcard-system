import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cardholderUpdateSchema } from '@/lib/schemas';
import { authenticateApiKey } from '@/lib/api-key-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth;

    const { id } = await params;
    const cardholderId = Number(id);
    if (isNaN(cardholderId)) {
      return NextResponse.json({ error: 'Invalid cardholder ID' }, { status: 400 });
    }

    const cardholder = await prisma.cardholder.findFirst({
      where: { id: cardholderId, pressId },
    });

    if (!cardholder) {
      return NextResponse.json({ error: 'Cardholder not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true, cardholder });
  } catch (error) {
    console.error('REST get single cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth;

    const { id } = await params;
    const cardholderId = Number(id);
    if (isNaN(cardholderId)) {
      return NextResponse.json({ error: 'Invalid cardholder ID' }, { status: 400 });
    }

    // ── Input validation ────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = cardholderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const messages = parsed.error.issues.map(i => i.message).join('; ');
      return NextResponse.json({ error: messages || 'Invalid input' }, { status: 400 });
    }

    const { name, designation, photoUrl, customFields, uniqueKey, active } = parsed.data;

    const cardholder = await prisma.cardholder.findFirst({
      where: { id: cardholderId, pressId },
    });

    if (!cardholder) {
      return NextResponse.json({ error: 'Cardholder not found or access denied' }, { status: 404 });
    }

    // Determine custom fields JSON
    let customFieldsStr = cardholder.customFields;
    if (customFields !== undefined || uniqueKey !== undefined) {
      const existingCustom = cardholder.customFields ? JSON.parse(cardholder.customFields) : {};
      const newCustom = customFields !== undefined ? { ...customFields } : { ...existingCustom };
      if (uniqueKey !== undefined) {
        if (uniqueKey) {
          newCustom.uniqueKey = uniqueKey;
        } else {
          delete newCustom.uniqueKey;
          delete newCustom.id;
          delete newCustom.unique_key;
        }
      }
      customFieldsStr = Object.keys(newCustom).length > 0 ? JSON.stringify(newCustom) : null;
    }

    const updated = await prisma.cardholder.update({
      where: { id: cardholderId },
      data: {
        name: name !== undefined ? name : cardholder.name,
        designation: designation !== undefined ? designation : cardholder.designation,
        photoUrl: photoUrl !== undefined ? photoUrl : cardholder.photoUrl,
        customFields: customFieldsStr,
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
    const auth = await authenticateApiKey(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth;

    const { id } = await params;
    const cardholderId = Number(id);
    if (isNaN(cardholderId)) {
      return NextResponse.json({ error: 'Invalid cardholder ID' }, { status: 400 });
    }

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
