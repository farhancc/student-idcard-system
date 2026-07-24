import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/marketplace/report?templateId=X
export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const templateId = Number(searchParams.get('templateId'));
    if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

    const template = await prisma.cardTemplate.findFirst({
      where: { id: templateId, isPublic: true },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const updated = await prisma.cardTemplate.update({
      where: { id: templateId },
      data: { reports: { increment: 1 } },
    });

    return NextResponse.json({ success: true, reports: updated.reports });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
