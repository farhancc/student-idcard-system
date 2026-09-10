import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const isCloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

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
  const rl = await rateLimit(`portal-upload:${ip}`, 20, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many upload requests. Please wait a minute.' },
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
    const type = (formData.get('type') as string) || 'photo'; // template | photo

    if (!token) {
      return NextResponse.json({ error: 'Missing security token' }, { status: 400 });
    }

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
      if (dept && dept.portalShare.active) {
        share = dept.portalShare;
      }
    }

    if (!share) {
      return NextResponse.json({ error: 'Invalid or deactivated portal link' }, { status: 403 });
    }

    const pressId = share.pressId;

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

    // Verify magic bytes rather than relying on client header
    const verifiedMimeType = validateImageMagicBytes(buffer);
    if (!verifiedMimeType) {
      return NextResponse.json(
        { error: 'Invalid file content. Only real JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      );
    }

    if (isCloudinaryConfigured) {
      // ── Cloudinary path ───────────────────────────────────────────────────
      const uploadResult = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: `press_${pressId}/${type}s`,
            resource_type: 'image',
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(buffer);
      });

      return NextResponse.json({
        success: true,
        url: uploadResult.secure_url,
        provider: 'cloudinary',
      });
    } else {
      // ── Fallback: base64 data URI (no filesystem writes) ──────────────────
      const base64 = buffer.toString('base64');
      const dataUri = `data:${verifiedMimeType};base64,${base64}`;

      return NextResponse.json({
        success: true,
        url: dataUri,
        provider: 'base64',
      });
    }
  } catch (error: unknown) {
    console.error('Portal upload handler error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
