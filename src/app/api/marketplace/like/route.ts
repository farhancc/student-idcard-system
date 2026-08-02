import { NextResponse } from 'next/server';
import { basePrisma } from '@/lib/prisma';

// POST /api/marketplace/like?templateId=X → toggle like for current press
export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const pressId = Number(pressIdStr);

    const { searchParams } = new URL(request.url);
    const templateId = Number(searchParams.get('templateId'));
    if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

    // Use basePrisma throughout — the template may belong to a different press
    // or be an official template (pressId: null); tenant-scoped prisma cannot see those.
    const template = await basePrisma.cardTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { isPublic: true },
          { pressId: null },
        ],
      },
      select: { id: true, likes: true },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Check if already liked by this press
    const existingLike = await basePrisma.templateLike.findUnique({
      where: {
        pressId_templateId: { pressId, templateId },
      },
    });

    let liked = false;
    let newLikesCount = template.likes;

    if (existingLike) {
      // Unlike
      await basePrisma.$transaction([
        basePrisma.templateLike.delete({
          where: { id: existingLike.id },
        }),
        basePrisma.cardTemplate.update({
          where: { id: templateId },
          data: { likes: { decrement: 1 } },
        }),
      ]);
      liked = false;
      newLikesCount = Math.max(0, template.likes - 1);
    } else {
      // Like
      await basePrisma.$transaction([
        basePrisma.templateLike.create({
          data: { pressId, templateId },
        }),
        basePrisma.cardTemplate.update({
          where: { id: templateId },
          data: { likes: { increment: 1 } },
        }),
      ]);
      liked = true;
      newLikesCount = template.likes + 1;
    }

    return NextResponse.json({ success: true, liked, likes: newLikesCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
