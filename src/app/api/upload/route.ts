import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Configure Cloudinary if environment variables are set
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
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string || 'template'; // template | photo

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (isCloudinaryConfigured) {
      console.log(`Uploading to Cloudinary for Press #${pressId}...`);
      // Upload directly to Cloudinary
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
      console.log(`Cloudinary credentials missing. Falling back to local upload for Press #${pressId}...`);
      // Fallback: Save locally
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', String(pressId), `${type}s`);
      fs.mkdirSync(uploadDir, { recursive: true });

      const fileExtension = path.extname(file.name) || '.png';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);

      fs.writeFileSync(filePath, buffer);

      if (fileExtension.toLowerCase() === '.pdf') {
        // Generate PNG preview using pdftoppm
        const pngPrefix = filePath.substring(0, filePath.lastIndexOf('.'));
        const cmd = `pdftoppm -png -r 150 -f 1 -l 1 "${filePath}" "${pngPrefix}"`;
        try {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          await execAsync(cmd);
          // pdftoppm generates prefix-1.png. Move it to prefix.png
          const generatedPngPath = `${pngPrefix}-1.png`;
          const targetPngPath = `${pngPrefix}.png`;
          if (fs.existsSync(generatedPngPath)) {
            fs.renameSync(generatedPngPath, targetPngPath);
          }
        } catch (err) {
          console.error('pdftoppm conversion error:', err);
        }
      } else if (fileExtension.toLowerCase() === '.svg') {
        // Generate PNG preview from SVG using sharp at high density (300 DPI) for print quality
        const pngPath = filePath.substring(0, filePath.lastIndexOf('.')) + '.png';
        try {
          const sharp = require('sharp');
          await sharp(buffer, { density: 300 }).png().toFile(pngPath);
        } catch (err) {
          console.error('Sharp SVG to PNG conversion error:', err);
        }
      }

      const localUrl = `/uploads/${pressId}/${type}s/${fileName}`;

      return NextResponse.json({ 
        success: true, 
        url: localUrl,
        provider: 'local_fallback'
      });
    }
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload image' }, { status: 500 });
  }
}
