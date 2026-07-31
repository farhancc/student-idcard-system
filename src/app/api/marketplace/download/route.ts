import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/marketplace/download?templateId=X&format=cdr|ai|pdf|psd
// Secure download gateway — only accessible to buyers or original owner
export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const pressId = Number(pressIdStr);

    const { searchParams } = new URL(request.url);
    const templateId = Number(searchParams.get('templateId'));
    const format = searchParams.get('format') || 'pdf';

    if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });
    if (!['cdr', 'ai', 'pdf', 'psd'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use: cdr, ai, pdf, psd' }, { status: 400 });
    }

    // Fetch the template
    const template = await prisma.cardTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true, pressId: true, isPublic: true,
        cdrFileUrl: true, aiFileUrl: true, pdfFileUrl: true, psdFileUrl: true,
      },
    });

    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Check access: either owner or verified purchaser
    const isOwner = template.pressId === pressId;
    const isPurchased = !isOwner
      ? await prisma.templatePurchase.findFirst({ where: { buyerPressId: pressId, templateId } })
      : null;

    if (!isOwner && !isPurchased) {
      return NextResponse.json({ error: 'Access denied. Purchase this template first.' }, { status: 403 });
    }

    const urlMap: Record<string, string | null | undefined> = {
      cdr: template.cdrFileUrl,
      ai: template.aiFileUrl,
      pdf: template.pdfFileUrl,
      psd: template.psdFileUrl,
    };

    const fileUrl = urlMap[format];
    if (!fileUrl) {
      return NextResponse.json({ error: `No ${format.toUpperCase()} file available for this template` }, { status: 404 });
    }

    // Redirect to the actual file (Cloudinary or similar)
    return NextResponse.redirect(fileUrl);
  } catch (error: any) {
    console.error('Marketplace download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
