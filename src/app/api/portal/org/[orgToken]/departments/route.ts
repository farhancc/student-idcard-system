import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgToken: string }> }
) {
  try {
    const { orgToken } = await params;

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

    // Fetch counts of cardholders in each department
    const deptsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const count = await prisma.cardholder.count({
          where: {
            clientId: share.clientId,
            pressId: share.pressId,
            enrollToken: dept.enrollToken,
          },
        });
        return {
          ...dept,
          enrolledCount: count,
        };
      })
    );

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
