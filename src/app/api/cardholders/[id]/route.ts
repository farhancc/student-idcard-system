import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cardholderUpdateSchema } from '@/lib/schemas';
import { requireActor } from '@/lib/authz';
import { normalizeGoogleDriveUrl } from '@/lib/pdf/field-resolver';
import { hardDeleteCardholder } from '@/lib/cardholder-delete';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
    const { id } = await params;
    const cardholderId = Number(id);

    const body = await request.json();
    const result = cardholderUpdateSchema.safeParse(body);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message).join('; ');
      console.error('[cardholder PUT] validation failed:', result.error.issues);
      return NextResponse.json({ error: messages || 'Invalid input' }, { status: 400 });
    }

    const { name, designation, photoUrl, customFields, active } = result.data;

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
        photoUrl: photoUrl !== undefined ? (photoUrl ? (normalizeGoogleDriveUrl(photoUrl) || photoUrl) : null) : cardholder.photoUrl,
        customFields: customFields !== undefined ? (customFields ? JSON.stringify(customFields) : null) : cardholder.customFields,
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
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
    const { id } = await params;
    const cardholderId = Number(id);

    const cardholder = await prisma.cardholder.findFirst({
      where: { id: cardholderId, pressId },
    });

    if (!cardholder) {
      return NextResponse.json({ error: 'Cardholder not found' }, { status: 404 });
    }

    // Hard delete: the row and its photo/rendered-face files are removed for
    // good, freeing DB and R2 storage immediately rather than leaving an
    // inactive row and orphaned files behind.
    const { filesDeleted, filesFailed } = await hardDeleteCardholder(cardholderId);

    return NextResponse.json({
      success: true,
      message: 'Cardholder deleted permanently',
      filesDeleted,
      filesFailed,
    });
  } catch (error) {
    console.error('Delete cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
