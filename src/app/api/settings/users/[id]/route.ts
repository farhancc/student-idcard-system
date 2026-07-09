import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userRole = request.headers.get('x-user-role');
    const currentUserIdStr = request.headers.get('x-user-id');

    if (!pressIdStr || !currentUserIdStr) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (userRole !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden: Only the Press Owner can delete staff users' }, { status: 403 });
    }

    const { id } = await params;
    const pressId = Number(pressIdStr);
    const userIdToDelete = Number(id);
    const currentUserId = Number(currentUserIdStr);

    if (isNaN(userIdToDelete)) {
      return NextResponse.json({ error: 'Invalid User ID' }, { status: 400 });
    }

    if (userIdToDelete === currentUserId) {
      return NextResponse.json({ error: 'Cannot remove your own user account' }, { status: 400 });
    }

    const user = await prisma.pressUser.findUnique({ where: { id: userIdToDelete } });

    if (!user || user.pressId !== pressId) {
      return NextResponse.json({ error: 'User not found or access denied' }, { status: 404 });
    }

    if (user.role === 'OWNER') {
      return NextResponse.json({ error: 'Cannot remove Owner accounts' }, { status: 400 });
    }

    await prisma.pressUser.delete({ where: { id: userIdToDelete } });

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete staff user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/users/[id]
 * Allows the Press OWNER to reset a staff member's password.
 * No current-password required — owner override.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userRole = request.headers.get('x-user-role');

    if (!pressIdStr) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (userRole !== 'OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: Only the Press Owner can reset staff passwords' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const pressId = Number(pressIdStr);
    const targetUserId = Number(id);

    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: 'Invalid User ID' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { newPassword } = body as { newPassword?: string };

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const user = await prisma.pressUser.findUnique({ where: { id: targetUserId } });

    if (!user || user.pressId !== pressId) {
      return NextResponse.json({ error: 'User not found or access denied' }, { status: 404 });
    }

    if (user.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot reset an Owner account password from here' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);
    await prisma.pressUser.update({
      where: { id: targetUserId },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset staff password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
