import { NextResponse } from 'next/server';
import { uploadToR2, isR2Configured } from '@/lib/storage';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { requireSuperAdmin } from '@/lib/authz';
import { sanitizeSvg } from '@/lib/svg-sanitizer';

// Configure separate Cloudinary for templates if set, otherwise fall back to main

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
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;

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
    let buffer = Buffer.from(bytes);

    if (fileExtension === '.svg') {
      const rawSvg = buffer.toString('utf8');
      const cleanSvg = sanitizeSvg(rawSvg);
      buffer = Buffer.from(cleanSvg, 'utf8');
    }

    const isVectorOrPdf = fileExtension === '.pdf' || fileExtension === '.svg';


    if (isR2Configured) {
      const prefix = `global/templates`;
      const stamp = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      const contentType =
        fileExtension === '.pdf' ? 'application/pdf'
        : fileExtension === '.svg' ? 'image/svg+xml'
        : fileExtension === '.png' ? 'image/png'
        : fileExtension === '.webp' ? 'image/webp'
        : fileExtension === '.jpg' || fileExtension === '.jpeg' ? 'image/jpeg'
        : 'application/octet-stream';
      const originalUrl = await uploadToR2({
        key: `${prefix}/originals/${stamp}${fileExtension}`,
        body: buffer,
        contentType,
      });

      if (isVectorOrPdf) {
        // R2 stores bytes and nothing else — there is no on-the-fly .pdf -> .png
        // conversion to fall back on, so a preview exists only if we rasterise
        // one here. When that is not possible the original stands in, exactly
        // as it does on the press-level upload route.
        const previewBuffer = await generatePreviewBuffer(buffer, fileExtension);
        const previewUrl = previewBuffer
          ? await uploadToR2({
              key: `${prefix}/previews/${stamp}.jpg`,
              body: previewBuffer,
              contentType: 'image/jpeg',
            })
          : originalUrl;

        return NextResponse.json({ success: true, url: previewUrl, originalUrl, provider: 'r2' });
      }

      return NextResponse.json({ success: true, url: originalUrl, provider: 'r2' });
    } else {
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        return NextResponse.json(
          { error: 'R2 credentials are not configured on this deployment. Persistent file storage is unavailable.' },
          { status: 503 }
        );
      }
      console.log(`R2 not configured for global templates. Falling back to local upload…`);
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
      let displayUrl = localUrl;
      if (fileExtension === '.pdf') {
        displayUrl = localUrl.replace('.pdf', '.png');
      }

      return NextResponse.json({
        success: true,
        url: displayUrl,
        originalUrl: originalLocalUrl ?? undefined,
        provider: 'local_fallback',
      });
    }
  } catch (error: unknown) {
    console.error('Global template upload handler error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
