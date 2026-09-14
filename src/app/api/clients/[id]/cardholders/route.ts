import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { normalizeGoogleDriveUrl } from '@/lib/pdf/field-resolver';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
    const { id } = await params;
    const clientId = Number(id);

    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get('limit') || searchParams.get('take');
    const offsetStr = searchParams.get('offset') || searchParams.get('skip');
    const limit = limitStr ? Number(limitStr) : undefined;
    const offset = offsetStr ? Number(offsetStr) : undefined;

    // Verify client belongs to this press
    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const [total, cardholders] = await Promise.all([
      prisma.cardholder.count({ where: { clientId } }),
      prisma.cardholder.findMany({
        where: { clientId },
        orderBy: { name: 'asc' },
        ...(limit !== undefined ? { take: limit } : {}),
        ...(offset !== undefined ? { skip: offset } : {}),
        include: {
          cardAsset: {
            select: { templateId: true }
          }
        }
      }),
    ]);

    const templates = await prisma.cardTemplate.findMany({
      where: {
        OR: [
          { clientId },
          { clientId: null }
        ],
        pressId
      },
      select: { id: true, name: true, frontFields: true, backFields: true }
    });
    const templateMap = new Map(templates.map(t => [t.id, t.name]));

    const shares = await prisma.clientPortalShare.findMany({
      where: { clientId, pressId },
      select: { enrollToken: true, templateId: true }
    });
    const depts = await prisma.clientDepartment.findMany({
      where: { portalShare: { clientId, pressId } },
      select: { enrollToken: true, portalShare: { select: { templateId: true } } }
    });
    const tokenToTemplateIdMap = new Map<string, number>();
    for (const s of shares) {
      if (s.enrollToken) tokenToTemplateIdMap.set(s.enrollToken, s.templateId);
    }
    for (const d of depts) {
      if (d.enrollToken) tokenToTemplateIdMap.set(d.enrollToken, d.portalShare.templateId);
    }

    const cardholdersWithTemplate = cardholders.map(ch => {
      let templateName = '—';
      let resolvedTemplateId: number | null = null;

      // Priority 1: Direct templateId on the cardholder row (manual add / CSV import)
      if ((ch as any).templateId) {
        resolvedTemplateId = (ch as any).templateId;
        templateName = templateMap.get(resolvedTemplateId!) || '—';
      }
      // Priority 2: enrollToken → portal share
      else if (ch.enrollToken && tokenToTemplateIdMap.has(ch.enrollToken)) {
        const tId = tokenToTemplateIdMap.get(ch.enrollToken)!;
        resolvedTemplateId = tId;
        templateName = templateMap.get(tId) || '—';
      }
      // Priority 3: compiled cardAsset
      else if (ch.cardAsset?.templateId) {
        resolvedTemplateId = ch.cardAsset.templateId;
        templateName = templateMap.get(ch.cardAsset.templateId) || '—';
      }

      return {
        ...ch,
        templateName,
        resolvedTemplateId,
      };
    });

    return NextResponse.json({
      success: true,
      cardholders: cardholdersWithTemplate,
      templates,
      total,
      limit: limit ?? cardholders.length,
      offset: offset ?? 0,
    });
  } catch (error) {
    console.error('Get cardholders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
    const { id } = await params;
    const clientId = Number(id);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { createCardholderSchema } = await import('@/lib/schemas');
    const parsed = createCardholderSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message || 'Invalid cardholder input' },
        { status: 400 }
      );
    }

    const { name, designation, photoUrl, customFields, ignoreDuplicate, templateId } = parsed.data;


    // Verify client
    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Duplicate check: name + designation (since uniqueKey concept is deprecated/removed)
    if (!ignoreDuplicate) {
      const duplicate = await prisma.cardholder.findFirst({
        where: { clientId, name, designation: designation ?? null },
      });

      if (duplicate) {
        return NextResponse.json({
          duplicate: true,
          error: `Cardholder "${name}" with designation "${designation || ''}" already exists.`,
          message: `Cardholder "${name}" with designation "${designation || ''}" already exists.`,
          cardholder: duplicate,
        }, { status: 409 });
      }
    }

    const cardholder = await prisma.cardholder.create({
      data: {
        pressId,
        clientId,
        name,
        designation,
        photoUrl: photoUrl ? (normalizeGoogleDriveUrl(photoUrl) || photoUrl) : null,
        customFields: customFields ? JSON.stringify(customFields) : null,
        active: true,
        ...(templateId ? { templateId: Number(templateId) } : {}),
      },
    });

    return NextResponse.json({ success: true, cardholder });
  } catch (error: any) {
    console.error('Create cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
