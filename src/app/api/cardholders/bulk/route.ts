import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const bulkSchema = z.object({
  ids: z.array(z.number()).min(1, 'At least one cardholder ID is required'),
  action: z.enum(['delete', 'activate', 'deactivate', 'reassign_template']),
  templateId: z.number().optional(), // required when action === 'reassign_template'
});

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }

    const { ids, action, templateId } = parsed.data;

    // Security: verify all cardholders belong to this press
    const count = await prisma.cardholder.count({
      where: { id: { in: ids }, pressId },
    });
    if (count !== ids.length) {
      return NextResponse.json({ error: 'One or more cardholders not found or access denied' }, { status: 403 });
    }

    switch (action) {
      case 'delete': {
        await prisma.cardholder.deleteMany({ where: { id: { in: ids }, pressId } });
        return NextResponse.json({ success: true, affected: ids.length, action: 'delete' });
      }

      case 'activate': {
        await prisma.cardholder.updateMany({
          where: { id: { in: ids }, pressId },
          data: { active: true },
        });
        return NextResponse.json({ success: true, affected: ids.length, action: 'activate' });
      }

      case 'deactivate': {
        await prisma.cardholder.updateMany({
          where: { id: { in: ids }, pressId },
          data: { active: false },
        });
        return NextResponse.json({ success: true, affected: ids.length, action: 'deactivate' });
      }

      case 'reassign_template': {
        if (!templateId) {
          return NextResponse.json({ error: 'templateId is required for reassign_template action' }, { status: 400 });
        }

        // Verify the template belongs to this press
        const tmpl = await prisma.cardTemplate.findFirst({
          where: { id: templateId, OR: [{ pressId }, { pressId: null }] },
        });
        if (!tmpl) {
          return NextResponse.json({ error: 'Template not found or access denied' }, { status: 404 });
        }

        await prisma.cardholder.updateMany({
          where: { id: { in: ids }, pressId },
          data: { templateId },
        });

        // Mark associated card assets as stale so they get regenerated
        await prisma.cardAsset.updateMany({
          where: { cardholderId: { in: ids } },
          data: { isStale: true },
        });

        return NextResponse.json({ success: true, affected: ids.length, action: 'reassign_template', templateId });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Bulk cardholder operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
