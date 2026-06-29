import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

const isCloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// GET /api/fonts — list all press fonts
export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);

    const fonts = await prisma.pressFont.findMany({
      where: { pressId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, fonts });
  } catch (err: any) {
    console.error('GET /api/fonts error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/fonts — upload a new font (multipart/form-data)
export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);

    const formData = await request.formData();
    const file     = formData.get('file') as File | null;
    const name     = (formData.get('name') as string || '').trim();
    const language = (formData.get('language') as string || 'en').trim();

    if (!file) return NextResponse.json({ error: 'No font file provided' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Font name is required' }, { status: 400 });

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext    = path.extname(file.name).toLowerCase(); // .ttf | .otf | .woff | .woff2

    const allowedExts = ['.ttf', '.otf', '.woff', '.woff2'];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: 'Unsupported font format. Upload TTF, OTF, WOFF, or WOFF2.' },
        { status: 400 }
      );
    }

    let fileUrl = '';

    if (isCloudinaryConfigured) {
      // Upload as raw asset so the original binary is preserved
      fileUrl = await new Promise<string>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: `press_${pressId}/fonts`,
            resource_type: 'raw',
            public_id: `${name.replace(/\s+/g, '_')}_${Date.now()}`,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result!.secure_url);
          }
        ).end(buffer);
      });
    } else {
      // Local fallback: if running in a serverless environment (Vercel) or if local write fails,
      // save as a base64 data URI to persist in DB without filesystem writes.
      const isServerless = !!process.env.VERCEL || process.env.NODE_ENV === 'production';
      
      if (isServerless) {
        const mimeType = ext === '.ttf' ? 'font/ttf' : ext === '.otf' ? 'font/otf' : ext === '.woff' ? 'font/woff' : 'font/woff2';
        const base64 = buffer.toString('base64');
        fileUrl = `data:${mimeType};base64,${base64}`;
      } else {
        try {
          const uploadDir = path.join(
            process.cwd(), 'public', 'uploads', String(pressId), 'fonts'
          );
          fs.mkdirSync(uploadDir, { recursive: true });
          const fileName = `${Date.now()}_${name.replace(/\s+/g, '_')}${ext}`;
          const filePath = path.join(uploadDir, fileName);
          fs.writeFileSync(filePath, buffer);
          fileUrl = `/uploads/${pressId}/fonts/${fileName}`;
        } catch (dirErr) {
          console.warn('Local filesystem write failed for font, falling back to base64:', dirErr);
          const mimeType = ext === '.ttf' ? 'font/ttf' : ext === '.otf' ? 'font/otf' : ext === '.woff' ? 'font/woff' : 'font/woff2';
          const base64 = buffer.toString('base64');
          fileUrl = `data:${mimeType};base64,${base64}`;
        }
      }
    }

    const font = await prisma.pressFont.create({
      data: { pressId, name, fileUrl, language },
    });

    return NextResponse.json({ success: true, font });
  } catch (err: any) {
    console.error('POST /api/fonts error:', err);
    return NextResponse.json({ error: err.message || 'Failed to upload font' }, { status: 500 });
  }
}
