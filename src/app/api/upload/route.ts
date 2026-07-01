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

/** Upload a raw Buffer to Cloudinary and return the secure URL. */
async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: 'auto' | 'image' | 'raw' = 'auto',
  publicIdSuffix?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts: any = { folder, resource_type: resourceType };
    if (publicIdSuffix) opts.public_id = publicIdSuffix;
    cloudinary.uploader
      .upload_stream(opts, (error, result) => {
        if (error) reject(error);
        else resolve(result!.secure_url);
      })
      .end(buffer);
  });
}

/**
 * Convert a PDF buffer to a 150-DPI JPEG WebP/JPEG preview buffer
 * using Cloudinary's built-in PDF rendering by re-fetching the
 * uploaded original with transformation parameters.
 *
 * We do this server-side via sharp (if available) + pdftoppm, then
 * upload the resulting JPEG as the preview image.
 */
async function generatePreviewBuffer(
  originalBuffer: Buffer,
  fileExtension: string
): Promise<Buffer | null> {
  try {
    if (fileExtension === '.pdf') {
      // Write temp file, run pdftoppm, read back
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const os = require('os');
      const execAsync = promisify(exec);

      const tmpDir = os.tmpdir();
      const tmpPdf = path.join(tmpDir, `preview_${Date.now()}.pdf`);
      const tmpPrefix = path.join(tmpDir, `preview_${Date.now()}`);
      fs.writeFileSync(tmpPdf, originalBuffer);

      // 150 DPI — fast, small, good enough for web preview
      await execAsync(`pdftoppm -png -r 150 -f 1 -l 1 "${tmpPdf}" "${tmpPrefix}"`);

      const generated = `${tmpPrefix}-1.png`;
      if (fs.existsSync(generated)) {
        const png = fs.readFileSync(generated);
        fs.unlinkSync(generated);
        fs.unlinkSync(tmpPdf);
        // Convert to JPEG 80% for smaller file
        try {
          const sharp = require('sharp');
          return await sharp(png).jpeg({ quality: 80 }).toBuffer();
        } catch {
          return png; // return raw PNG if sharp not available
        }
      }
      fs.unlinkSync(tmpPdf);
      return null;
    }

    if (fileExtension === '.svg') {
      try {
        const sharp = require('sharp');
        // 150 DPI, JPEG preview for SVG
        return await sharp(originalBuffer, { density: 150 })
          .jpeg({ quality: 80 })
          .toBuffer();
      } catch {
        return null;
      }
    }

    return null; // raster images don't need a separate preview
  } catch (err) {
    console.error('Preview generation error:', err);
    return null;
  }
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
    const type = (formData.get('type') as string) || 'template'; // template | photo

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
      const folder = `press_${pressId}/${type}s`;

      if (isVectorOrPdf && type === 'template') {
        // ── Dual-upload strategy for PDF/SVG templates ──────────────
        // 1. Upload the original file (for Electron renderer fallback)
        console.log(`Uploading original ${fileExtension} to Cloudinary (press #${pressId})…`);
        const originalUrl = await uploadBufferToCloudinary(buffer, `${folder}/originals`, 'auto');

        // 2. Generate lightweight preview and upload it
        console.log('Generating 150 DPI preview…');
        const previewBuffer = await generatePreviewBuffer(buffer, fileExtension);

        let previewUrl = originalUrl; // safe fallback if preview generation fails
        if (previewBuffer) {
          previewUrl = await uploadBufferToCloudinary(
            previewBuffer,
            `${folder}/previews`,
            'image'
          );
        }

        return NextResponse.json({
          success: true,
          url: previewUrl,         // lightweight display image (stored in frontImageUrl)
          originalUrl,             // high-res original (stored in frontOriginalUrl)
          provider: 'cloudinary',
        });
      } else {
        // ── Single-upload for raster images and non-template types ──
        console.log(`Uploading to Cloudinary for Press #${pressId}…`);
        const url = await uploadBufferToCloudinary(buffer, folder, 'auto');
        return NextResponse.json({ success: true, url, provider: 'cloudinary' });
      }
    } else {
      // ── Local fallback (dev / no Cloudinary) ────────────────────
      console.log(`Cloudinary not configured. Falling back to local upload for Press #${pressId}…`);
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', String(pressId), `${type}s`);
      fs.mkdirSync(uploadDir, { recursive: true });

      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer);

      let originalLocalUrl: string | null = null;

      if (fileExtension === '.pdf') {
        // Generate 600 DPI PNG for local Electron rendering (stored alongside original)
        const pngPrefix = filePath.replace('.pdf', '');
        try {
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          await execAsync(`pdftoppm -png -r 600 -f 1 -l 1 "${filePath}" "${pngPrefix}"`);
          const generated = `${pngPrefix}-1.png`;
          if (fs.existsSync(generated)) fs.renameSync(generated, `${pngPrefix}.png`);
        } catch (err) {
          console.error('pdftoppm error:', err);
        }
        originalLocalUrl = `/uploads/${pressId}/${type}s/${fileName}`;
      } else if (fileExtension === '.svg') {
        try {
          const sharp = require('sharp');
          const pngPath = filePath.replace('.svg', '.png');
          await sharp(buffer, { density: 300 }).png().toFile(pngPath);
        } catch (err) {
          console.error('Sharp SVG error:', err);
        }
        originalLocalUrl = `/uploads/${pressId}/${type}s/${fileName}`;
      }

      const localUrl = `/uploads/${pressId}/${type}s/${fileName}`;

      return NextResponse.json({
        success: true,
        url: localUrl,
        originalUrl: originalLocalUrl ?? undefined,
        provider: 'local_fallback',
      });
    }
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload image' }, { status: 500 });
  }
}
