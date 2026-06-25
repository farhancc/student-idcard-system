import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderCardSide } from '@/lib/pdf/card-engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgToken: string; id: string }> }
) {
  try {
    const { orgToken, id } = await params;
    const chId = Number(id);

    // 1. Verify orgToken matches active ClientPortalShare
    const share = await prisma.clientPortalShare.findUnique({
      where: { orgToken },
    });

    if (!share || !share.active) {
      return new Response('Unauthorized or invalid token', { status: 404 });
    }

    // 2. Fetch Cardholder and verify ownership
    const cardholder = await prisma.cardholder.findUnique({
      where: { id: chId },
    });

    if (!cardholder || cardholder.clientId !== share.clientId || cardholder.pressId !== share.pressId) {
      return new Response('Cardholder not found or unauthorized', { status: 404 });
    }

    // 3. Fetch template assigned to this share
    const template = await prisma.cardTemplate.findFirst({
      where: { id: share.templateId, pressId: share.pressId },
    });

    if (!template) {
      return new Response('Template not found', { status: 404 });
    }

    // 4. Fetch press fonts
    const pressFonts = await prisma.pressFont.findMany({
      where: { pressId: share.pressId },
    });

    const { searchParams } = new URL(request.url);
    const side = (searchParams.get('side') || 'front') as 'front' | 'back';

    if (side !== 'front' && side !== 'back') {
      return new Response('Invalid side parameter. Must be "front" or "back".', { status: 400 });
    }

    // 5. Render side
    const validTillDate = new Date();
    validTillDate.setFullYear(validTillDate.getFullYear() + 1);

    const imageBuffer = await renderCardSide(
      template,
      {
        id: cardholder.id,
        name: cardholder.name,
        designation: cardholder.designation,
        photoUrl: cardholder.photoUrl,
        cardSerial: cardholder.cardSerial,
        customFields: cardholder.customFields,
      },
      side,
      validTillDate,
      pressFonts
    );

    // Return raw image buffer directly
    return new Response(new Uint8Array(imageBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Org preview card error:', error);
    return new Response('Internal server error rendering preview', { status: 500 });
  }
}
