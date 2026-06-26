import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/prisma';

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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const token = formData.get('token') as string || ''; // orgToken or enrollToken
    const type = formData.get('type') as string || 'photo'; // template | photo

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (isCloudinaryConfigured) {
      // ── Cloudinary path ───────────────────────────────────────────────────
      const uploadResult = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: `press_${pressId}/${type}s`,
            resource_type: 'auto',
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
      // Vercel's /var/task is read-only — we cannot write to public/uploads.
      // Instead, encode the photo as a data URI and store it directly in the DB.
      const mimeType = file.type || 'image/jpeg';
      const base64 = buffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;

      return NextResponse.json({
        success: true,
        url: dataUri,
        provider: 'base64',
      });
    }
  } catch (error: any) {
    console.error('Portal upload handler error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload image' }, { status: 500 });
  }
}
