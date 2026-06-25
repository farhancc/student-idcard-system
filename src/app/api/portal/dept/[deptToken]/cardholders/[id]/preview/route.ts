import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderCardSide } from '@/lib/pdf/card-engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deptToken: string; id: string }> }
) {
  try {
    const { deptToken, id } = await params;
    const chId = Number(id);

    const dept = await prisma.clientDepartment.findUnique({
      where: { deptToken },
      include: { portalShare: true },
    });

    if (!dept || !dept.portalShare.active) {
      return new Response('Unauthorized or invalid token', { status: 404 });
    }

    const cardholder = await prisma.cardholder.findFirst({
      where: { id: chId, clientId: dept.portalShare.clientId, enrollToken: dept.enrollToken },
    });

    if (!cardholder) {
      return new Response('Cardholder not found or unauthorized', { status: 404 });
    }

    const template = await prisma.cardTemplate.findFirst({
      where: { id: dept.portalShare.templateId, pressId: dept.portalShare.pressId },
    });

    if (!template) {
      return new Response('Template not found', { status: 404 });
    }

    const pressFonts = await prisma.pressFont.findMany({
      where: { pressId: dept.portalShare.pressId },
    });

    const { searchParams } = new URL(request.url);
    const side = (searchParams.get('side') || 'front') as 'front' | 'back';

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

    return new Response(new Uint8Array(imageBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Dept preview card error:', error);
    return new Response('Internal server error rendering preview', { status: 500 });
  }
}
