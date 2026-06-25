import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Check if token matches orgToken in ClientPortalShare
    let share = await prisma.clientPortalShare.findUnique({
      where: { orgToken: token, active: true },
    });

    let type: 'org' | 'dept' | 'enroll' = 'org';
    let departmentName: string | null = null;
    let enrollToken: string | null = null;

    if (share) {
      type = 'org';
      enrollToken = share.enrollToken;
    } else {
      // 2. Check if token matches deptToken in ClientDepartment
      const dept = await prisma.clientDepartment.findUnique({
        where: { deptToken: token },
        include: { portalShare: true },
      });

      if (dept && dept.portalShare.active) {
        share = dept.portalShare;
        type = 'dept';
        departmentName = dept.name;
        enrollToken = dept.enrollToken;
      } else {
        // 3. Check if token matches enrollToken in ClientDepartment
        const enrollDept = await prisma.clientDepartment.findUnique({
          where: { enrollToken: token },
          include: { portalShare: true },
        });

        if (enrollDept && enrollDept.portalShare.active) {
          share = enrollDept.portalShare;
          type = 'enroll';
          departmentName = enrollDept.name;
          enrollToken = enrollDept.enrollToken;
        } else {
          // 4. Check if token matches global enrollToken in ClientPortalShare
          share = await prisma.clientPortalShare.findUnique({
            where: { enrollToken: token, active: true },
          });

          if (share) {
            type = 'enroll';
            enrollToken = share.enrollToken;
          }
        }
      }
    }

    if (!share) {
      return NextResponse.json({ error: 'Invalid or expired portal link' }, { status: 404 });
    }

    // Fetch Client and Template details
    const client = await prisma.client.findUnique({
      where: { id: share.clientId },
      select: { id: true, name: true, type: true },
    });

    const template = await prisma.cardTemplate.findUnique({
      where: { id: share.templateId },
      select: {
        id: true,
        name: true,
        cardWidth: true,
        cardHeight: true,
        frontImageUrl: true,
        backImageUrl: true,
        frontFields: true,
        backFields: true,
      },
    });

    return NextResponse.json({
      success: true,
      type,
      client,
      template,
      departmentName,
      share: {
        id: share.id,
        enrollToken: enrollToken || share.enrollToken,
        orgToken: share.orgToken,
        createdAt: share.createdAt,
      },
    });
  } catch (error) {
    console.error('Get portal share details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Only allow deactivating via orgToken
    const share = await prisma.clientPortalShare.findFirst({
      where: { orgToken: token },
    });

    if (!share) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    await prisma.clientPortalShare.update({
      where: { id: share.id },
      data: { active: false },
    });

    return NextResponse.json({ success: true, message: 'Portal link deactivated successfully' });
  } catch (error) {
    console.error('Deactivate portal share error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
