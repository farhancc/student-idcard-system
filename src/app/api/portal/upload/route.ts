import { NextResponse } from 'next/server';
import { prisma, withPressContext } from '@/lib/prisma';
import { enterPortalTenant } from '@/lib/portal-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { uploadToR2, isR2Configured } from '@/lib/storage';
import crypto from 'crypto';

function validateImageMagicBytes(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`portal-upload:${ip}`, 60, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many upload requests. Please wait before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const token = (formData.get('token') as string) || ''; // orgToken or enrollToken
    const rawType = (formData.get('type') as string) || 'photo';
    // `type` becomes a path segment in the storage key below — only ever
    // accept the two values this endpoint is documented to use.
    const type = rawType === 'template' ? 'template' : 'photo';

    if (!token) {
      return NextResponse.json({ error: 'Missing security token' }, { status: 400 });
    }

    // Resolve the token to its press before any tenant-scoped query runs.
    const pressId = await enterPortalTenant(token);
    if (pressId === null) {
      return NextResponse.json({ error: 'Invalid security token' }, { status: 404 });
    }

    return await withPressContext(pressId, async () => {
      let share = await prisma.clientPortalShare.findFirst({
        where: {
          OR: [
            { orgToken: token, active: true },
            { enrollToken: token, active: true },
          ],
        },
      });

      if (!share) {
        // Check if it's a department head or department staff token
        const dept = await prisma.clientDepartment.findFirst({
          where: {
            OR: [
              { deptToken: token },
              { enrollToken: token },
            ],
          },
          include: { portalShare: true },
        });
        if (dept && dept.portalShare?.active) {
          share = dept.portalShare;
        }
      }

      if (!share) {
        return NextResponse.json({ error: 'Invalid or deactivated portal link' }, { status: 403 });
      }

      const sharePressId = share.pressId;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Limit file size to 5MB
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Verify magic bytes
      const verifiedMimeType = validateImageMagicBytes(buffer);
      if (!verifiedMimeType) {
        return NextResponse.json(
          { error: 'Invalid file content. Only real JPEG, PNG, and WebP images are allowed.' },
          { status: 400 }
        );
      }

      const ext = verifiedMimeType === 'image/png' ? 'png' : verifiedMimeType === 'image/webp' ? 'webp' : 'jpg';
      const hash = crypto.randomBytes(8).toString('hex');
      const key = `press_${sharePressId}/${type}s/${Date.now()}-${hash}.${ext}`;

      const url = await uploadToR2({
        key,
        body: buffer,
        contentType: verifiedMimeType,
      });

      return NextResponse.json({
        success: true,
        url,
        provider: isR2Configured ? 'r2' : 'local',
      });
    });
  } catch (error: unknown) {
    console.error('Portal upload handler error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
