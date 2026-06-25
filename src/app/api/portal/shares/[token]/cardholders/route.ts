import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    let share = await prisma.clientPortalShare.findFirst({
      where: {
        OR: [
          { orgToken: token },
          { enrollToken: token },
        ],
      },
    });

    let enrollTokensToFilter: string[] = [];

    if (share) {
      const depts = await prisma.clientDepartment.findMany({
        where: { portalShareId: share.id },
        select: { enrollToken: true },
      });
      enrollTokensToFilter = [share.enrollToken, ...depts.map(d => d.enrollToken)];
    } else {
      const dept = await prisma.clientDepartment.findFirst({
        where: {
          OR: [
            { deptToken: token },
            { enrollToken: token },
          ],
        },
        include: { portalShare: true },
      });
      if (dept) {
        share = dept.portalShare;
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
