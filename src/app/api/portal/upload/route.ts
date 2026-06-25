import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
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
        provider: 'cloudinary'
      });
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', String(pressId), `${type}s`);
      fs.mkdirSync(uploadDir, { recursive: true });

      const fileExtension = path.extname(file.name) || '.png';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);

      fs.writeFileSync(filePath, buffer);
      const localUrl = `/uploads/${pressId}/${type}s/${fileName}`;

      return NextResponse.json({ 
        success: true, 
        url: localUrl,
        provider: 'local_fallback'
      });
    }
  } catch (error: any) {
    console.error('Portal upload handler error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload image' }, { status: 500 });
  }
}
