import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const orderId = Number(id);

    const notes = await prisma.orderNote.findMany({
      where: { orderId, pressId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error('Get notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');
    if (!pressIdStr || !userIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const userId = Number(userIdStr);
    const { id } = await params;
    const orderId = Number(id);

    const { content, note } = await request.json();
    const noteText = content || note;

    if (!noteText || !noteText.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify order
    const order = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const user = await prisma.pressUser.findUnique({
      where: { id: userId },
    });
    const authorName = user ? user.name : 'Unknown User';

    const createdNote = await prisma.orderNote.create({
      data: {
        orderId,
        pressId,
        authorId: userId,
        authorName,
        content: noteText.trim(),
      },
    });

    // Also write an activity log entry
    await prisma.orderActivityLog.create({
      data: {
        orderId,
        pressId,
        actorId: userId,
        actorName: authorName,
        action: 'NOTE_ADDED',
        note: `Added note: "${noteText.trim().substring(0, 60)}..."`,
      },
    });

    return NextResponse.json({ success: true, note: createdNote });
  } catch (error) {
    console.error('Create note error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
