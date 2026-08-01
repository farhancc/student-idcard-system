import { NextResponse } from 'next/server';
// Use basePrisma (raw client without tenant middleware) so that all presses'
// public templates are visible in the marketplace, not just the current press's.
import { basePrisma as prisma } from '@/lib/prisma';
import { formatFieldLabel as formatFieldLabelCentral } from '@/lib/pdf/field-resolver';

export const dynamic = 'force-dynamic';

// GET /api/marketplace?category=&search=&sort=popular|newest|price_asc|price_desc&page=1&limit=20
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'popular';
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const limit = Math.min(40, Number(searchParams.get('limit') || '20'));
    const skip = (page - 1) * limit;

    // Optional: filter by file formats
    const hasCdr = searchParams.get('has_cdr') === '1';
    const hasAi = searchParams.get('has_ai') === '1';
    const hasPsd = searchParams.get('has_psd') === '1';
    const hasPdf = searchParams.get('has_pdf') === '1';
    const hasPhoto = searchParams.get('has_photo') === '1';
    const hasQr = searchParams.get('has_qr') === '1';
    const hasBarcode = searchParams.get('has_barcode') === '1';
    const priceFilter = searchParams.get('price') || ''; // 'free' | 'paid'

    const pressIdStr = request.headers.get('x-press-id');
    const pressId = pressIdStr ? Number(pressIdStr) : null;

    // All marketplace listings must be explicitly published (isPublic: true).
    // Official/global templates (pressId: null) are also subject to this requirement.
    // NOTE: isLatest is intentionally omitted — templates are versioned in-place
    // (same row ID), so every published row is always the latest version.
    // The is_latest column may not exist in all production DB environments.
    const where: any = {
      isPublic: true,
      isModerated: false,
    };

    if (category) where.category = category;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (hasCdr) where.cdrFileUrl = { not: null };
    if (hasAi) where.aiFileUrl = { not: null };
    if (hasPsd) where.psdFileUrl = { not: null };
    if (hasPdf) where.pdfFileUrl = { not: null };
    if (priceFilter === 'free') where.price = 0;
    if (priceFilter === 'paid') where.price = { gt: 0 };

    // Field content filters: check JSON fields contain certain types
    const fieldConditions: any[] = [];
    if (hasPhoto) {
      fieldConditions.push({
        OR: [
          { frontFields: { contains: '"photo"' } },
          { frontFields: { contains: '"image"' } },
          { backFields: { contains: '"photo"' } },
          { backFields: { contains: '"image"' } },
        ],
      });
    }
    if (hasQr) {
      fieldConditions.push({
        OR: [
          { frontFields: { contains: '"qr"' } },
          { backFields: { contains: '"qr"' } },
        ],
      });
    }
    if (hasBarcode) {
      fieldConditions.push({
        OR: [
          { frontFields: { contains: '"barcode"' } },
          { backFields: { contains: '"barcode"' } },
        ],
      });
    }
    if (fieldConditions.length > 0) {
      where.AND = fieldConditions;
    }

    let orderBy: any = { likes: 'desc' };
    if (sort === 'newest') orderBy = { createdAt: 'desc' };
    else if (sort === 'price_asc') orderBy = { price: 'asc' };
    else if (sort === 'price_desc') orderBy = { price: 'desc' };

    const [templates, total] = await Promise.all([
      prisma.cardTemplate.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          category: true,
          sides: true,
          cardWidth: true,
          cardHeight: true,
          frontImageUrl: true,
          backImageUrl: true,
          frontOriginalUrl: true,
          backOriginalUrl: true,
          price: true,
          likes: true,
          reports: true,
          cdrFileUrl: true,
          aiFileUrl: true,
          psdFileUrl: true,
          pdfFileUrl: true,
          frontFields: true,
          backFields: true,
          pressId: true,
          press: { select: { name: true } },
          createdAt: true,
        },
      }),
      prisma.cardTemplate.count({ where }),
    ]);

    const templateIds = templates.map(t => t.id);

    let likedSet = new Set<number>();
    let reportedSet = new Set<number>();
    let purchasedSet = new Set<number>();

    if (pressId && templateIds.length > 0) {
      const [userLikes, userReports, userPurchases] = await Promise.all([
        prisma.templateLike.findMany({
          where: { pressId, templateId: { in: templateIds } },
          select: { templateId: true },
        }),
        prisma.templateReport.findMany({
          where: { pressId, templateId: { in: templateIds } },
          select: { templateId: true },
        }),
        prisma.templatePurchase.findMany({
          where: { buyerPressId: pressId, templateId: { in: templateIds } },
          select: { templateId: true },
        }),
      ]);
      likedSet = new Set(userLikes.map(l => l.templateId));
      reportedSet = new Set(userReports.map(r => r.templateId));
      purchasedSet = new Set(userPurchases.map(p => p.templateId));
    }

    // Enrich: detect field types & fields summary without exposing exact X/Y coordinates
    const enriched = templates.map(t => {
      let fieldTypes: string[] = [];
      let fieldsSummary: { key: string; name: string; label: string; type: string; side: 'Front' | 'Back'; prefix?: string; suffix?: string; sampleValue?: string }[] = [];
      try {
        const front = JSON.parse(t.frontFields || '[]');
        const back = JSON.parse(t.backFields || '[]');
        fieldTypes = [...new Set([...front, ...back].map((f: any) => f.type))];
        
        const getSampleVal = (f: any) => {
          if (f.sampleValue || f.defaultValue || f.value) return f.sampleValue || f.defaultValue || f.value;
          if (f.type === 'static_text' || f.type === 'static') return f.text || f.label || 'Static Label';
          const key = (f.key || f.field || '').toLowerCase();
          if (key.includes('name')) return 'John Doe';
          if (key.includes('desig') || key.includes('role')) return 'Student / Staff';
          if (key.includes('roll') || key.includes('id') || key.includes('serial')) return 'STU-2026-09';
          if (key.includes('valid') || key.includes('date') || key.includes('exp')) return '31/12/2027';
          if (key.includes('blood')) return 'B+';
          if (key.includes('phone') || key.includes('mobile')) return '+1 555 0192';
          if (key.includes('school') || key.includes('org')) return 'Greenwood Academy';
          if (f.type === 'image' || f.type === 'photo') return '[Cardholder Photo]';
          if (f.type === 'qr') return '[QR Code Data]';
          if (f.type === 'barcode') return '[Barcode Data]';
          return 'Sample Data';
        };

        fieldsSummary = [
          ...front.map((f: any) => {
            const resolvedName = formatFieldLabel(f);
            return {
              key: f.key || f.field || f.id || f.type || 'field',
              name: resolvedName,
              label: resolvedName,
              type: f.type || 'text',
              side: 'Front' as const,
              prefix: f.prefix || '',
              suffix: f.suffix || '',
              sampleValue: getSampleVal(f),
            };
          }),
          ...back.map((f: any) => {
            const resolvedName = formatFieldLabel(f);
            return {
              key: f.key || f.field || f.id || f.type || 'field',
              name: resolvedName,
              label: resolvedName,
              type: f.type || 'text',
              side: 'Back' as const,
              prefix: f.prefix || '',
              suffix: f.suffix || '',
              sampleValue: getSampleVal(f),
            };
          }),
        ];
      } catch (e) {
        console.error('Failed to parse fields for marketplace template:', e);
      }

      return {
        ...t,
        frontFields: t.frontFields,
        backFields: t.backFields,
        fieldsSummary,
        sellerName: t.pressId ? t.press?.name : 'IDexo Official',
        isOfficial: !t.pressId,
        fieldTypes,
        isLiked: likedSet.has(t.id),
        isReported: reportedSet.has(t.id),
        isPurchased: purchasedSet.has(t.id),
        hasPhoto: fieldTypes.includes('image') || fieldTypes.includes('photo'),
        hasQr: fieldTypes.includes('qr'),
        hasBarcode: fieldTypes.includes('barcode'),
        hasCdr: !!t.cdrFileUrl,
        hasAi: !!t.aiFileUrl,
        hasPsd: !!t.psdFileUrl,
        hasPdf: !!t.pdfFileUrl,
        // Never expose raw file URLs — use download endpoint
        cdrFileUrl: undefined,
        aiFileUrl: undefined,
        psdFileUrl: undefined,
        pdfFileUrl: undefined,
      };
    });

    return NextResponse.json({
      templates: enriched,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Marketplace GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function formatFieldLabel(f: any): string {
  if (f.label && typeof f.label === 'string' && f.label.trim()) return f.label.trim();
  if (f.name && typeof f.name === 'string' && f.name.trim()) return f.name.trim();
  if (f.field && typeof f.field === 'string' && f.field.trim()) {
    return formatFieldLabelCentral(f.field);
  }
  if (f.key && typeof f.key === 'string' && f.key.trim() && f.key !== f.type) {
    return formatFieldLabelCentral(f.key);
  }
  if (f.text && typeof f.text === 'string' && f.text.trim()) return f.text.trim();

  const t = (f.type || '').toLowerCase();
  if (t === 'photo' || t === 'image') return 'Cardholder Photo';
  if (t === 'qr') return 'QR Code';
  if (t === 'barcode') return 'Barcode';
  if (t === 'signature' || t === 'sig') return 'Signature';
  if (t === 'id') return 'ID / Serial Number';
  if (t === 'date') return 'Date Field';

  return 'Cardholder Field';
}
