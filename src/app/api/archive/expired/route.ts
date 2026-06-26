import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    // 90 days threshold
    const date90DaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Find all expired cardholders
    const cardholders = await prisma.cardholder.findMany({
      where: {
        pressId,
        createdAt: { lt: date90DaysAgo },
      },
      include: {
        client: true,
      },
    });

    if (cardholders.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch all templates to avoid querying them inside loops
    const templates = await prisma.cardTemplate.findMany({
      where: { pressId },
    });

    const groupsMap = new Map<string, {
      clientName: string;
      templateName: string;
      templateFields: string[];
      records: Array<{
        id: number;
        photoUrl: string | null;
        fields: Record<string, string>;
      }>;
    }>();

    for (const ch of cardholders) {
      let resolvedTemplate = null;

      // 1. Try to find template via CardAsset
      const asset = await prisma.cardAsset.findFirst({
        where: { cardholderId: ch.id },
      });

      if (asset) {
        resolvedTemplate = templates.find(t => t.id === asset.templateId) || null;
      }

      // 2. Try to find template via CardOrder containing this cardholder ID
      if (!resolvedTemplate) {
        const order = await prisma.cardOrder.findFirst({
          where: {
            pressId,
            clientId: ch.clientId,
            cardholders: {
              some: {
                cardholderId: ch.id,
              },
            },
          },
        });
        if (order) {
          resolvedTemplate = templates.find(t => t.id === order.templateId) || null;
        }
      }

      // 3. Try to get client-specific latest template
      if (!resolvedTemplate) {
        resolvedTemplate = templates.find(t => t.clientId === ch.clientId && t.isLatest) || null;
      }

      // 4. Default fallback latest template
      if (!resolvedTemplate) {
        resolvedTemplate = templates.find(t => t.isLatest) || null;
      }

      const clientName = ch.client?.name || 'Unknown Client';
      const templateName = resolvedTemplate?.name || 'Default Template';
      const groupKey = `${clientName}::${templateName}`;

      // Extract template fields
      const fieldKeysSet = new Set<string>(['Name', 'Designation', 'Unique Key', 'Card Serial']);
      if (resolvedTemplate) {
        try {
          const front = JSON.parse(resolvedTemplate.frontFields || '[]');
          const back = JSON.parse(resolvedTemplate.backFields || '[]');
          front.forEach((f: any) => { if (f.key) fieldKeysSet.add(f.key); });
          back.forEach((b: any) => { if (b.key) fieldKeysSet.add(b.key); });
        } catch (err) {
          console.error(`Error parsing template fields for template #${resolvedTemplate.id}:`, err);
        }
      }

      // Map values
      const recordFields: Record<string, string> = {
        'Name': ch.name,
        'Designation': ch.designation || '',
        'Unique Key': ch.uniqueKey || '',
        'Card Serial': ch.cardSerial || '',
      };

      if (ch.customFields) {
        try {
          const custom = JSON.parse(ch.customFields);
          Object.keys(custom).forEach(k => {
            recordFields[k] = String(custom[k] || '');
            fieldKeysSet.add(k);
          });
        } catch (err) {
          console.error(`Error parsing customFields for cardholder #${ch.id}:`, err);
        }
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          clientName,
          templateName,
          templateFields: Array.from(fieldKeysSet),
          records: [],
        });
      }

      const grp = groupsMap.get(groupKey)!;
      
      // Update templateFields set to encompass any custom field keys found
      Array.from(fieldKeysSet).forEach(k => {
        if (!grp.templateFields.includes(k)) {
          grp.templateFields.push(k);
        }
      });

      grp.records.push({
        id: ch.id,
        photoUrl: ch.photoUrl,
        fields: recordFields,
      });
    }

    return NextResponse.json({
      success: true,
      data: Array.from(groupsMap.values()),
    });
  } catch (error: any) {
    console.error('Fetch expired cardholders error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
