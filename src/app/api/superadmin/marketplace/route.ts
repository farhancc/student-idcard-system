import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/superadmin/marketplace — list all public templates, sorted by reports desc
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const limit = 30;
    const skip = (page - 1) * limit;
    const filter = searchParams.get('filter') || 'all'; // 'all' | 'reported' | 'moderated'

    const where: any = { isPublic: true };
    if (filter === 'reported') where.reports = { gt: 0 };
    if (filter === 'moderated') where.isModerated = true;

    const [templates, total] = await Promise.all([
      prisma.cardTemplate.findMany({
        where,
        orderBy: { reports: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, name: true, category: true, sides: true,
          price: true, likes: true, reports: true,
          isModerated: true, isPublic: true,
          frontImageUrl: true,
          press: { select: { id: true, name: true, email: true } },
          createdAt: true,
        },
      }),
      prisma.cardTemplate.count({ where }),
    ]);

    return NextResponse.json({ templates, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/superadmin/marketplace — moderate (hide/unhide) or delete a template
// Body: { templateId, action: 'hide' | 'unhide' | 'delete' }
export async function POST(request: Request) {
  try {
    const { templateId, action } = await request.json();
    if (!templateId || !action) return NextResponse.json({ error: 'templateId and action required' }, { status: 400 });

    const template = await prisma.cardTemplate.findUnique({ where: { id: Number(templateId) } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    if (action === 'hide') {
      await prisma.cardTemplate.update({
        where: { id: Number(templateId) },
        data: { isModerated: true },
      });
      await prisma.systemAuditLog.create({
        data: {
          actorType: 'SUPER_ADMIN', actorName: 'Super Admin',
          action: 'MARKETPLACE_TEMPLATE_HIDDEN', category: 'CONTENT',
          description: `Hidden template "${template.name}" (id=${templateId}) from marketplace`,
          ipAddress: ip, severity: 'WARNING',
        },
      });
      return NextResponse.json({ success: true, message: 'Template hidden from marketplace' });
    }

    if (action === 'unhide') {
      await prisma.cardTemplate.update({
        where: { id: Number(templateId) },
        data: { isModerated: false },
      });
      return NextResponse.json({ success: true, message: 'Template restored to marketplace' });
    }

    if (action === 'delete') {
      await prisma.cardTemplate.delete({ where: { id: Number(templateId) } });
      await prisma.systemAuditLog.create({
        data: {
          actorType: 'SUPER_ADMIN', actorName: 'Super Admin',
          action: 'MARKETPLACE_TEMPLATE_DELETED', category: 'CONTENT',
          description: `Deleted template "${template.name}" (id=${templateId}) from marketplace`,
          ipAddress: ip, severity: 'CRITICAL',
        },
      });
      return NextResponse.json({ success: true, message: 'Template deleted' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
