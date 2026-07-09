import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Only OWNER can delete staff users
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

    // Cannot delete yourself
    if (userIdToDelete === currentUserId) {
      return NextResponse.json({ error: 'Cannot remove your own user account' }, { status: 400 });
    }

    // Verify user belongs to same press
    const user = await prisma.pressUser.findUnique({
      where: { id: userIdToDelete }
    });

    if (!user || user.pressId !== pressId) {
      return NextResponse.json({ error: 'User not found or access denied' }, { status: 404 });
    }

    // Cannot delete the owner
    if (user.role === 'OWNER') {
      return NextResponse.json({ error: 'Cannot remove Owner accounts' }, { status: 400 });
    }

    await prisma.pressUser.delete({
      where: { id: userIdToDelete }
    });

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete staff user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
