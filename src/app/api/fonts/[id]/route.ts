import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

// DELETE /api/fonts/[id] — remove a press font
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
    const fontId  = Number(id);

    // Ensure font belongs to this press before deleting
    const font = await prisma.pressFont.findFirst({
      where: { id: fontId, pressId },
    });

    if (!font) {
      return NextResponse.json({ error: 'Font not found' }, { status: 404 });
    }

    await prisma.pressFont.delete({ where: { id: fontId } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/fonts/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
