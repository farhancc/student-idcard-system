import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { enrollSchema } from '@/lib/schemas';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ enrollToken: string }> }
) {
  // ── Rate limiting: 20 submissions per hour per IP ─────────────────────────
  const ip = getClientIp(request);
  const rl = await rateLimit(`enroll:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Please wait before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  try {
    const { enrollToken } = await params;

    // 1. Resolve share (either global enrollToken or department enrollToken)
    let share = await prisma.clientPortalShare.findUnique({
      where: { enrollToken, active: true },
    });

    if (!share) {
      const dept = await prisma.clientDepartment.findUnique({
        where: { enrollToken },
        include: { portalShare: true },
      });

      if (dept && dept.portalShare.active) {
        share = dept.portalShare;
      }
    }

    if (!share) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    // Enforce 30-day expiration policy for security
    const expirationPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
    const isExpired = Date.now() - new Date(share.createdAt).getTime() > expirationPeriod;
    if (isExpired) {
      return NextResponse.json({ error: 'This enrollment link has expired (expired after 30 days)' }, { status: 410 });
    }

    // ── Input validation ────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = enrollSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { name, designation, photoUrl, customFields, uniqueKey } = parsed.data;

    // Fetch template to validate Number min/max caps
    const template = share.templateId ? await prisma.cardTemplate.findUnique({ where: { id: share.templateId } }) : null;

    if (template) {
      try {
        const front = JSON.parse(template.frontFields || '[]');
        const back = JSON.parse(template.backFields || '[]');
        const allFields: any[] = [...front, ...back];

        if (customFields && typeof customFields === 'object') {
          for (const f of allFields) {
            if (f.field && f.type === 'number') {
              const rawVal = (customFields as Record<string, any>)[f.field];
              if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
                const numVal = Number(rawVal);
                const label = f.label || f.field;
                if (isNaN(numVal)) {
                  return NextResponse.json({ error: `${label} must be a valid number` }, { status: 400 });
                }
                if (f.min !== undefined && f.min !== null && numVal < f.min) {
                  return NextResponse.json({ error: `${label} must be at least ${f.min}` }, { status: 400 });
                }
                if (f.max !== undefined && f.max !== null && numVal > f.max) {
                  return NextResponse.json({ error: `${label} cannot exceed ${f.max}` }, { status: 400 });
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse template fields for validation:', err);
      }
    }

    // Generate unique card serial number if needed
    const cardSerial = uniqueKey || `C-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Fold uniqueKey into customFields if provided
    const custom = customFields || {};
    if (uniqueKey && !custom.uniqueKey && !custom.id && !custom.unique_key) {
      custom.uniqueKey = uniqueKey;
    }

    const cardholder = await prisma.cardholder.create({
      data: {
        pressId: share.pressId,
        clientId: share.clientId,
        name,
        designation: designation ?? null,
        photoUrl: photoUrl ?? null,
        customFields: Object.keys(custom).length > 0 ? JSON.stringify(custom) : null,
        cardSerial,
        enrollToken, // Stores either the global enrollToken or the department enrollToken
      },
    });

    return NextResponse.json({ success: true, cardholder });
  } catch (error) {
    console.error('Portal enrollment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
