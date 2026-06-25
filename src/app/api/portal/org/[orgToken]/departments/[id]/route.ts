import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgToken: string; id: string }> }
) {
  try {
    const { orgToken, id: deptIdStr } = await params;
    const deptId = Number(deptIdStr);

    const share = await prisma.clientPortalShare.findUnique({
      where: { orgToken },
    });

    if (!share || !share.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const dept = await prisma.clientDepartment.findFirst({
      where: { id: deptId, portalShareId: share.id },
    });

    if (!dept) {
      return NextResponse.json({ error: 'Department not found or unauthorized' }, { status: 404 });
    }

    // Delete the department
    await prisma.clientDepartment.delete({
      where: { id: deptId },
    });

    return NextResponse.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Org delete department error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
