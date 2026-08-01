import { NextResponse } from 'next/server';
import { prisma, basePrisma } from '@/lib/prisma';

// POST /api/marketplace/report?templateId=X
export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const pressId = Number(pressIdStr);

    const { searchParams } = new URL(request.url);
    const templateId = Number(searchParams.get('templateId'));
    if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

    const template = await basePrisma.cardTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { isPublic: true },
          { pressId: null },
        ],
      },
      select: { id: true, reports: true },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const existingReport = await prisma.templateReport.findUnique({
      where: {
        pressId_templateId: { pressId, templateId },
      },
    });

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this template.', alreadyReported: true },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.templateReport.create({
        data: { pressId, templateId },
      }),
      prisma.cardTemplate.update({
        where: { id: templateId },
        data: { reports: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ success: true, reported: true, reports: template.reports + 1 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
