import { NextResponse } from 'next/server';
import { prisma, enterPressContext } from '@/lib/prisma';
import { syncTemplateFieldRows } from '@/lib/template-field-sync';
import crypto from 'crypto';

import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { clientSignupSchema } from '@/lib/schemas';
import { acceptanceContextFromRequest, recordLegalAcceptance } from '@/lib/legal/acceptance';

export async function GET() {
  try {
    const presses = await prisma.press.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        city: true,
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ success: true, presses });
  } catch (error) {
    console.error('Fetch presses error:', error);
    return NextResponse.json({ error: 'Failed to fetch presses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // ── Rate limiting: 5 client signups per hour per IP ──────────────────────
  const ip = getClientIp(request);
  const rl = await rateLimit(`client_signup:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please wait before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  try {
    // ── Input validation ─────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = clientSignupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { pressId, name, type, contactName, contactPhone, contactEmail, address } = parsed.data;

    const press = await prisma.press.findUnique({
      where: { id: Number(pressId) },
    });

    if (!press) {
      return NextResponse.json({ error: 'Selected Printing Press not found' }, { status: 404 });
    }

    // The client is signing up *under* this press, which is the tenant for
    // everything below. Adopted only after confirming the press exists.
    enterPressContext(press.id);

    // Create the Client
    const client = await prisma.client.create({
      data: {
        pressId: Number(pressId),
        name,
        type,
        contactName,
        contactPhone,
        contactEmail,
        address,
      },
    });

    // The organisation has just warranted that it is entitled to share a
    // roster with this press. Record which version it warranted that under.
    await recordLegalAcceptance({
      point: 'CLIENT_SIGNUP',
      subjectType: 'CLIENT',
      subjectId: client.id,
      pressId: press.id,
      context: acceptanceContextFromRequest(request),
    });

    // Find first template of the press
    let template = await prisma.cardTemplate.findFirst({
      where: { pressId: Number(pressId), isLatest: true },
    });

    if (!template) {
      template = await prisma.cardTemplate.findFirst({
        where: { pressId: Number(pressId) },
      });
    }

    let templateId = template?.id;

    if (!templateId) {
      // Create a default layout/template if none exists
      const newTemplate = await prisma.cardTemplate.create({
        data: {
          pressId: Number(pressId),
          name: 'Default ID Template',
          cardWidth: 673,
          cardHeight: 1039,
          frontImageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000',
          frontFields: '[]',
          backFields: '[]',
          version: 1,
          isLatest: true,
        },
      });
      await syncTemplateFieldRows(prisma, newTemplate.id, newTemplate.frontFields, newTemplate.backFields);
      templateId = newTemplate.id;
    }

    // Generate tokens
    const orgToken = crypto.randomUUID();
    const enrollToken = crypto.randomUUID();

    // Create Client Portal Share link
    const share = await prisma.clientPortalShare.create({
      data: {
        pressId: Number(pressId),
        clientId: client.id,
        templateId,
        orgToken,
        enrollToken,
      },
    });

    return NextResponse.json({
      success: true,
      orgToken,
      clientId: client.id,
    });
  } catch (error: unknown) {
    console.error('Client signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
