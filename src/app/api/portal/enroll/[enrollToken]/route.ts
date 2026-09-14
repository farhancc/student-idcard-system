import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enterPortalTenant } from '@/lib/portal-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { enrollSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    // Resolve the token to its press before any tenant-scoped query runs.
    if ((await enterPortalTenant(enrollToken)) === null) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

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

    // Fetch template (resolving latest version) to validate Number min/max caps
    let template = share.templateId ? await prisma.cardTemplate.findUnique({ where: { id: share.templateId } }) : null;
    if (template) {
      const latestVersion = await prisma.cardTemplate.findFirst({
        where: {
          OR: [
            { id: template.id },
            { parentId: template.id },
            ...(template.parentId ? [{ id: template.parentId }, { parentId: template.parentId }] : []),
            ...(template.name ? [{ name: template.name, ...(template.pressId ? { pressId: template.pressId } : {}) }] : [])
          ],
          isLatest: true
        },
        orderBy: [
          { version: 'desc' },
          { id: 'desc' }
        ]
      });
      if (latestVersion) {
        template = latestVersion;
      }
    }

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

    // Fold uniqueKey into customFields if provided and sync uniqueKey column
    const custom = customFields || {};
    let extractedUniqueKey = uniqueKey || custom.uniqueKey || custom.id || custom.unique_key;
    if (!extractedUniqueKey) {
      for (const [ck, cv] of Object.entries(custom)) {
        const ckClean = ck.toLowerCase().replace(/[^a-z0-9]/g, '');
        if ((ckClean === 'id' || ckClean === 'studentid' || ckClean === 'employeeid' || ckClean === 'empid' || ckClean === 'admno' || ckClean === 'uniquekey' || ckClean === 'unique_key') && cv && typeof cv === 'string' && !cv.startsWith('C-')) {
          extractedUniqueKey = cv;
          break;
        }
      }
    }

    if (extractedUniqueKey && !String(extractedUniqueKey).startsWith('C-')) {
      custom.uniqueKey = String(extractedUniqueKey);
    }

    // Always generate an internal cardSerial
    const cardSerial = `C-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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

    return NextResponse.json({
      success: true,
      cardholder: {
        name: cardholder.name,
        designation: cardholder.designation,
      },
    });
  } catch (error) {
    console.error('Portal enrollment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
