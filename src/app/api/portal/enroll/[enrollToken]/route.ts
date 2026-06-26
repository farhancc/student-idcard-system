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
  const rl = rateLimit(`enroll:${ip}`, 20, 60 * 60 * 1000);
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

    // Automatically fall back to custom fields for uniqueKey if not provided
    let finalUniqueKey = uniqueKey ?? null;
    if (!finalUniqueKey && customFields) {
      const keys = Object.keys(customFields);
      const possibleUniqueKeys = ['rollNo', 'roll_no', 'empId', 'employeeId', 'uniqueKey', 'id'];
      const match = keys.find(k => possibleUniqueKeys.some(p => k.toLowerCase() === p.toLowerCase()));
      if (match) {
        finalUniqueKey = customFields[match] ?? null;
      }
    }

    // Check unique key constraint if provided
    if (finalUniqueKey) {
      const existing = await prisma.cardholder.findFirst({
        where: { clientId: share.clientId, uniqueKey: finalUniqueKey },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Cardholder with Unique Key/Roll Number '${finalUniqueKey}' already exists.` },
          { status: 400 }
        );
      }
    }

    // Generate unique card serial number if needed
    const cardSerial = finalUniqueKey || `C-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const cardholder = await prisma.cardholder.create({
      data: {
        pressId: share.pressId,
        clientId: share.clientId,
        name,
        designation: designation ?? null,
        photoUrl: photoUrl ?? null,
        customFields: customFields ? JSON.stringify(customFields) : null,
        uniqueKey: finalUniqueKey || null,
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
