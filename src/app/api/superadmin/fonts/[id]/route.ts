import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/superadmin/fonts/[id] — remove a global (system-wide) font
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fontId  = Number(id);

    // Ensure the font is a global font
    const font = await prisma.pressFont.findFirst({
      where: { id: fontId, pressId: null },
    });

    if (!font) {
      return NextResponse.json({ error: 'Global font not found' }, { status: 404 });
    }

    await prisma.pressFont.delete({ where: { id: fontId } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/superadmin/fonts/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
