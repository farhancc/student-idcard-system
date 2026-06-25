import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
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

    const { name, designation, photoUrl, customFields, uniqueKey, active } = await request.json();

    const cardholder = await prisma.cardholder.findFirst({
      where: { id: cardholderId, pressId },
    });

    if (!cardholder) {
      return NextResponse.json({ error: 'Cardholder not found' }, { status: 404 });
    }

    // Update
    const updatedCardholder = await prisma.cardholder.update({
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

    // Mark associated CardAsset as stale if data changed (Selective Regeneration)
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

    return NextResponse.json({ success: true, cardholder: updatedCardholder });
  } catch (error) {
    console.error('Update cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    const cardholder = await prisma.cardholder.findFirst({
      where: { id: cardholderId, pressId },
    });

    if (!cardholder) {
      return NextResponse.json({ error: 'Cardholder not found' }, { status: 404 });
    }

    // Database cascade handles CardAsset deletion
    await prisma.cardholder.delete({
      where: { id: cardholderId },
    });

    return NextResponse.json({
      success: true,
      message: 'Cardholder deleted successfully',
    });
  } catch (error) {
    console.error('Delete cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
