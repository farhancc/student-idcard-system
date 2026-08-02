import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/superadmin/users/[id]
 * Hard deletes a specific PressUser permanently from the database.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = Number(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid User ID' }, { status: 400 });
    }

    const user = await prisma.pressUser.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, pressId: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Hard delete user from DB
    await prisma.pressUser.delete({
      where: { id: userId },
    });

    // Audit Log
    await prisma.systemAuditLog.create({
      data: {
        pressId: user.pressId,
        actorType: 'SUPER_ADMIN',
        actorName: 'Super Admin',
        action: 'HARD_DELETE_USER',
        category: 'USER',
        resourceType: 'PressUser',
        resourceId: String(userId),
        description: `Permanently hard deleted ${user.role} user "${user.name}" (${user.email}).`,
        ipAddress: '127.0.0.1',
        severity: 'WARN',
      },
    });

    return NextResponse.json({
      success: true,
      message: `User "${user.name}" hard deleted permanently.`,
    });
  } catch (error: any) {
    console.error('Superadmin hard delete user error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
