import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enterPortalTenant } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    // Resolve the token to its press before any tenant-scoped query runs.
    if ((await enterPortalTenant(token)) === null) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get('limit') || searchParams.get('take');
    const offsetStr = searchParams.get('offset') || searchParams.get('skip');
    const limit = limitStr ? Number(limitStr) : undefined;
    const offset = offsetStr ? Number(offsetStr) : undefined;

    let share = await prisma.clientPortalShare.findUnique({
      where: { orgToken: token },
      include: {
        departments: {
          select: { enrollToken: true },
        },
      },
    });

    let enrollTokensToFilter: string[] = [];

    if (share) {
      enrollTokensToFilter = [share.enrollToken, ...share.departments.map(d => d.enrollToken)];
    } else {
      const dept = await prisma.clientDepartment.findUnique({
        where: { deptToken: token },
        include: { portalShare: true },
      });
      if (dept) {
        share = { ...dept.portalShare, departments: [] };
        enrollTokensToFilter = [dept.enrollToken];
      }
    }

    if (!share) {
      return NextResponse.json({ error: 'Portal link not found' }, { status: 404 });
    }

    const cardholders = await prisma.cardholder.findMany({
      where: {
        clientId: share.clientId,
        enrollToken: { in: enrollTokensToFilter },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit !== undefined ? { take: limit } : {}),
      ...(offset !== undefined ? { skip: offset } : {}),
    });

    const template = await prisma.cardTemplate.findUnique({
      where: { id: share.templateId },
      select: { name: true }
    });
    const templateName = template?.name || '—';

    const cardholdersWithTemplate = cardholders.map(ch => ({
      ...ch,
      templateName
    }));

    return NextResponse.json({ success: true, cardholders: cardholdersWithTemplate });
  } catch (error) {
    console.error('Get share cardholders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
