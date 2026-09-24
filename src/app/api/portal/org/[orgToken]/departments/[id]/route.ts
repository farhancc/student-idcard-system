import { NextResponse } from 'next/server';
import { prisma, withPressContext } from '@/lib/prisma';
import { enterPortalTenant } from '@/lib/portal-auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgToken: string; id: string }> }
) {
  try {
    const { orgToken, id: deptIdStr } = await params;
    // Resolve the token to its press before any tenant-scoped query runs.
    const pressId = await enterPortalTenant(orgToken);
    if (pressId === null) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }
    const deptId = Number(deptIdStr);

    return await withPressContext(pressId, async () => {
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
    });
  } catch (error) {
    console.error('Org delete department error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
