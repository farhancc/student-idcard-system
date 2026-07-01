import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { signupSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  // ── Rate limiting: 5 signups per hour per IP ──────────────────────────────
  const ip = getClientIp(request);
  const rl = await rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
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
    // ── Input validation ────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { pressName, ownerName, email, password, phone, city } = parsed.data;

    // Check if email already exists in press users
    const existingUser = await prisma.pressUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Set trial expiration to 14 days from now
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const passwordHash = await hashPassword(password);

    // Create Press and Owner user in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const press = await tx.press.create({
        data: {
          name: pressName,
          email,
          phone,
          city,
          plan: 'BASIC',
          isActive: true,
          credits: 200,
          trialEndsAt,
        },
      });

      const user = await tx.pressUser.create({
        data: {
          pressId: press.id,
          name: ownerName,
          email,
          passwordHash,
          role: 'OWNER',
          active: true,
        },
      });

      return { press, user };
    });

    return NextResponse.json({
      success: true,
      message: 'Press registered successfully',
      pressId: result.press.id,
      userId: result.user.id,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
