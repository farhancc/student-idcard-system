import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    if (hasPhoto) where.frontFields = { contains: '"photo"' };
    if (hasQr) where.frontFields = { contains: '"qr"' };
    if (hasBarcode) where.frontFields = { contains: '"barcode"' };

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
          price: true,
          likes: true,
          reports: true,
          cdrFileUrl: true,
          aiFileUrl: true,
          psdFileUrl: true,
          pdfFileUrl: true,
          frontFields: true,
          pressId: true,
          press: { select: { name: true } },
          createdAt: true,
        },
      }),
      prisma.cardTemplate.count({ where }),
    ]);

    // Enrich: detect field types from JSON without exposing coordinates
    const enriched = templates.map(t => {
      let fieldTypes: string[] = [];
      try {
        const front = JSON.parse(t.frontFields || '[]');
        const back = JSON.parse((t as any).backFields || '[]');
        fieldTypes = [...new Set([...front, ...back].map((f: any) => f.type))];
      } catch {}

      return {
        ...t,
        frontFields: undefined, // don't expose coordinates in marketplace
        sellerName: t.pressId ? t.press?.name : 'IDexo Official',
        isOfficial: !t.pressId,
        fieldTypes,
        hasPhoto: fieldTypes.includes('image'),
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
