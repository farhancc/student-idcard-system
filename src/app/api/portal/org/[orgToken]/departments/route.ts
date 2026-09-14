import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enterPortalTenant } from '@/lib/portal-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgToken: string }> }
) {
  try {
    const { orgToken } = await params;
    // Resolve the token to its press before any tenant-scoped query runs.
    if ((await enterPortalTenant(orgToken)) === null) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const share = await prisma.clientPortalShare.findUnique({
      where: { orgToken },
    });

    if (!share || !share.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const departments = await prisma.clientDepartment.findMany({
      where: { portalShareId: share.id },
      orderBy: { name: 'asc' },
    });

    const enrollTokens = departments.map(d => d.enrollToken).filter(Boolean);

    // Fetch counts of cardholders in all departments using a single groupBy query
    const counts = enrollTokens.length > 0
      ? await prisma.cardholder.groupBy({
          by: ['enrollToken'],
          where: {
            clientId: share.clientId,
            pressId: share.pressId,
            enrollToken: { in: enrollTokens },
          },
          _count: { _all: true },
        })
      : [];

    const countMap = new Map(counts.map(c => [c.enrollToken, c._count._all]));

    const deptsWithCounts = departments.map((dept) => ({
      ...dept,
      enrolledCount: countMap.get(dept.enrollToken) || 0,
    }));

    return NextResponse.json({ success: true, departments: deptsWithCounts });
  } catch (error) {
    console.error('Org get departments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgToken: string }> }
) {
  try {
    const { orgToken } = await params;
    // Resolve the token to its press before any tenant-scoped query runs.
    if ((await enterPortalTenant(orgToken)) === null) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const share = await prisma.clientPortalShare.findUnique({
      where: { orgToken },
    });

    if (!share || !share.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const deptToken = crypto.randomUUID();
    const enrollToken = crypto.randomUUID();

    const department = await prisma.clientDepartment.create({
      data: {
        portalShareId: share.id,
        name: name.trim(),
        deptToken,
        enrollToken,
      },
    });

    return NextResponse.json({ success: true, department });
  } catch (error) {
    console.error('Org create department error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
