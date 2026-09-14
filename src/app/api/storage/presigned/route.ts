import { NextResponse } from 'next/server';
import { getPresignedUploadUrl } from '@/lib/storage';
import { requireActor } from '@/lib/authz';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import crypto from 'crypto';
import { z } from 'zod';

/**
 * Hand the browser a short-lived R2 URL it can PUT one image to.
 *
 * The object key is derived entirely server-side from the authenticated press.
 * It must never be caller-influenced: a presigned PUT is a write capability, so
 * a caller-supplied key is a write-anywhere-in-the-bucket primitive — including
 * over another tenant's photos. Key shape matches /api/upload.
 */
const CONTENT_TYPE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

const presignedRequestSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    message: 'Only JPEG, PNG, and WebP images are allowed',
  }),
  assetType: z.enum(['photo', 'logo', 'signature']).optional().default('photo'),
});

export async function POST(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    // ── Rate Limiting (20 presigned URLs / min per press) ──────────────────
    const rl = await rateLimit(`presigned:${pressId}:${getClientIp(request)}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for upload URL generation.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
    }

    const parsed = presignedRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map(i => i.message).join('; ');
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { contentType, assetType } = parsed.data;
    const ext = CONTENT_TYPE_EXTENSIONS[contentType];
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const key = `press_${pressId}/${assetType}s/${Date.now()}-${uniqueId}.${ext}`;

    const presigned = await getPresignedUploadUrl({
      key,
      contentType,
      expiresIn: 3600, // 1 hour validity
    });

    return NextResponse.json({ success: true, ...presigned });
  } catch (error) {
    console.error('Presigned upload URL generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
