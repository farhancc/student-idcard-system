import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderCardSide } from '@/lib/pdf/card-engine';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ enrollToken: string }> }
) {
  try {
    const { enrollToken } = await params;
    const { searchParams } = new URL(request.url);
    const side = (searchParams.get('side') || 'front') as 'front' | 'back';

    // Resolve the share record (either global enrollToken or department enrollToken)
    let share = await prisma.clientPortalShare.findUnique({
      where: { enrollToken, active: true },
    });

    if (!share) {
      const dept = await prisma.clientDepartment.findUnique({
        where: { enrollToken },
        include: { portalShare: true },
      });

      if (dept && dept.portalShare.active) {
        share = dept.portalShare;
      }
    }

    if (!share) {
      return new Response('Invalid or expired enrollment link', { status: 404 });
    }

    // Fetch the template assigned to this share
    const template = await prisma.cardTemplate.findFirst({
      where: { id: share.templateId, pressId: share.pressId },
    });

    if (!template) {
      return new Response('Template not found', { status: 404 });
    }

    // Fetch press fonts
    const pressFonts = await prisma.pressFont.findMany({
      where: { pressId: share.pressId },
    });

    // Read live form data from the request body
    const body = await request.json().catch(() => ({}));
    const {
      name = 'Your Name',
      designation = null,
      photoUrl = null,
      customFields = {},
    } = body;

    const cardholderData = {
      id: 0,
      name: name || 'Your Name',
      designation: designation || null,
      photoUrl: photoUrl || null,
      cardSerial: null,
      customFields: typeof customFields === 'string' ? customFields : JSON.stringify(customFields),
    };

    const validTillDate = new Date();
    validTillDate.setFullYear(validTillDate.getFullYear() + 1);

    const imageBuffer = await renderCardSide(
      template,
      cardholderData,
      side,
      validTillDate,
      pressFonts
    );

    return new Response(new Uint8Array(imageBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Portal preview error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
