import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Configure separate Cloudinary for templates if set, otherwise fall back to main
const useTemplateCloudinary = !!(
  process.env.TEMPLATE_CLOUDINARY_CLOUD_NAME &&
  process.env.TEMPLATE_CLOUDINARY_API_KEY &&
  process.env.TEMPLATE_CLOUDINARY_API_SECRET
);

const useMainCloudinary = !useTemplateCloudinary && !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const cloudinaryInstance = cloudinary;

if (useTemplateCloudinary) {
  cloudinaryInstance.config({
    cloud_name: process.env.TEMPLATE_CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.TEMPLATE_CLOUDINARY_API_KEY,
    api_secret: process.env.TEMPLATE_CLOUDINARY_API_SECRET,
  });
} else if (useMainCloudinary) {
  cloudinaryInstance.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const isCloudinaryConfigured = useTemplateCloudinary || useMainCloudinary;

async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: 'auto' | 'image' | 'raw' = 'auto',
  publicIdSuffix?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts: any = { folder, resource_type: resourceType };
    if (publicIdSuffix) opts.public_id = publicIdSuffix;
    cloudinaryInstance.uploader
      .upload_stream(opts, (error, result) => {
        if (error) reject(error);
        else resolve(result!.secure_url);
      })
      .end(buffer);
  });
}

async function generatePreviewBuffer(
  originalBuffer: Buffer,
  fileExtension: string
): Promise<Buffer | null> {
  try {
    if (fileExtension === '.pdf') {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const os = require('os');
      const execAsync = promisify(exec);

      const tmpDir = os.tmpdir();
      const tmpPdf = path.join(tmpDir, `global_preview_${Date.now()}.pdf`);
      const tmpPrefix = path.join(tmpDir, `global_preview_${Date.now()}`);
      fs.writeFileSync(tmpPdf, originalBuffer);

      await execAsync(`pdftoppm -png -r 150 -f 1 -l 1 "${tmpPdf}" "${tmpPrefix}"`);

      const generated = `${tmpPrefix}-1.png`;
      if (fs.existsSync(generated)) {
        const png = fs.readFileSync(generated);
        fs.unlinkSync(generated);
        fs.unlinkSync(tmpPdf);
        try {
          const sharp = require('sharp');
          return await sharp(png).jpeg({ quality: 80 }).toBuffer();
        } catch {
          return png;
        }
      }
      fs.unlinkSync(tmpPdf);
      return null;
    }

    if (fileExtension === '.svg') {
      try {
        const sharp = require('sharp');
        return await sharp(originalBuffer, { density: 150 })
          .jpeg({ quality: 80 })
          .toBuffer();
      } catch {
        return null;
      }
    }

    return null;
  } catch (err) {
    console.error('Global template preview generation error:', err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Limit file size to 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    // Whitelist file extensions and MIME types
    const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf'];
    const ALLOWED_MIME_TYPES = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
    ];

    const fileExtension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExtension) || !ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only standard images, SVGs, and PDFs are allowed.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const isVectorOrPdf = fileExtension === '.pdf' || fileExtension === '.svg';


    if (isCloudinaryConfigured) {
      const folder = `global/templates`;

      if (isVectorOrPdf) {
        console.log(`Uploading global original ${fileExtension} to Cloudinary…`);
        const originalUrl = await uploadBufferToCloudinary(buffer, `${folder}/originals`, 'auto');

        console.log('Generating 150 DPI preview for global template…');
        const previewBuffer = await generatePreviewBuffer(buffer, fileExtension);

        let previewUrl = originalUrl;
        if (previewBuffer) {
          previewUrl = await uploadBufferToCloudinary(
            previewBuffer,
            `${folder}/previews`,
            'image'
          );
        }

        return NextResponse.json({
          success: true,
          url: previewUrl,
          originalUrl,
          provider: 'cloudinary',
        });
      } else {
        console.log(`Uploading global raster template to Cloudinary…`);
        const url = await uploadBufferToCloudinary(buffer, folder, 'auto');
        return NextResponse.json({ success: true, url, provider: 'cloudinary' });
      }
    } else {
      console.log(`Cloudinary not configured for global templates. Falling back to local upload…`);
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'global', 'templates');
      fs.mkdirSync(uploadDir, { recursive: true });

      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer);

      let originalLocalUrl: string | null = null;

      if (fileExtension === '.pdf') {
        const pngPrefix = filePath.replace('.pdf', '');
        try {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          await execAsync(`pdftoppm -png -r 600 -f 1 -l 1 "${filePath}" "${pngPrefix}"`);
          const generated = `${pngPrefix}-1.png`;
          if (fs.existsSync(generated)) fs.renameSync(generated, `${pngPrefix}.png`);
        } catch (err) {
          console.error('pdftoppm error on global template:', err);
        }
        originalLocalUrl = `/uploads/global/templates/${fileName}`;
      } else if (fileExtension === '.svg') {
        try {
          const sharp = require('sharp');
          const pngPath = filePath.replace('.svg', '.png');
          await sharp(buffer, { density: 300 }).png().toFile(pngPath);
        } catch (err) {
          console.error('Sharp SVG error on global template:', err);
        }
        originalLocalUrl = `/uploads/global/templates/${fileName}`;
      }

      const localUrl = `/uploads/global/templates/${fileName}`;

      return NextResponse.json({
        success: true,
        url: localUrl,
        originalUrl: originalLocalUrl ?? undefined,
        provider: 'local_fallback',
      });
    }
  } catch (error: any) {
    console.error('Global template upload handler error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload image' }, { status: 500 });
  }
}
