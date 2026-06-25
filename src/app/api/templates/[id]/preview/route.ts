import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderCardSide } from '@/lib/pdf/card-engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return new Response('Missing Press ID', { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const templateId = Number(id);

    const { searchParams } = new URL(request.url);
    const cardholderIdStr = searchParams.get('cardholderId');
    const side = (searchParams.get('side') || 'front') as 'front' | 'back';

    if (side !== 'front' && side !== 'back') {
      return new Response('Invalid side parameter. Must be "front" or "back".', { status: 400 });
    }

    // 1. Fetch template
    const template = await prisma.cardTemplate.findFirst({
      where: { id: templateId, pressId },
    });

    if (!template) {
      return new Response('Template not found', { status: 404 });
    }

    // 2. Fetch fonts uploaded by this press
    const pressFonts = await prisma.pressFont.findMany({
      where: { pressId },
    });

    // 3. Fetch cardholder or construct dummy preview data
    let cardholderData: {
      id: number;
      name: string;
      designation: string | null;
      photoUrl: string | null;
      cardSerial: string | null;
      customFields: string | null;
    } = {
      id: 99,
      name: 'John Doe',
      designation: 'Student / Employee',
      photoUrl: null,
      cardSerial: 'STU-1234',
      customFields: JSON.stringify({
        bloodGroup: 'B+',
        rollNumber: '2026-99',
        schoolName: 'Greenwood High School',
      }),
    };

    let validTillDate = new Date();
    validTillDate.setFullYear(validTillDate.getFullYear() + 1);

    if (cardholderIdStr) {
      const dbCardholder = await prisma.cardholder.findFirst({
        where: { id: Number(cardholderIdStr), pressId },
      });
      if (dbCardholder) {
        cardholderData = {
          id: dbCardholder.id,
          name: dbCardholder.name,
          designation: dbCardholder.designation,
          photoUrl: dbCardholder.photoUrl,
          cardSerial: dbCardholder.cardSerial,
          customFields: dbCardholder.customFields,
        };
      }
    }

    // 4. Render side
    const imageBuffer = await renderCardSide(
      template,
      cardholderData,
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
    console.error('Preview card error:', error);
    return new Response('Internal server error rendering preview', { status: 500 });
  }
}
