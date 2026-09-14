import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { uploadToR2, isR2Configured } from '@/lib/storage';
import path from 'path';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import crypto from 'crypto';
import fs from 'fs';
import { sanitizeSvg } from '@/lib/svg-sanitizer';

/**
 * Convert a PDF or SVG buffer to a preview image buffer.
 */
async function generatePreviewBuffer(
  originalBuffer: Buffer,
  fileExtension: string
): Promise<Buffer | null> {
  try {
    if (fileExtension === '.pdf') {
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const os = require('os');
      const execFileAsync = promisify(execFile);

      const tmpDir = os.tmpdir();
      const tmpPdf = path.join(tmpDir, `preview_${Date.now()}.pdf`);
      const tmpPrefix = path.join(tmpDir, `preview_${Date.now()}`);
      fs.writeFileSync(tmpPdf, originalBuffer);

      await execFileAsync('pdftoppm', ['-png', '-r', '150', '-f', '1', '-l', '1', tmpPdf, tmpPrefix]);

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
    console.error('Preview generation error:', err);
    return null;
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`upload:${ip}`, 60, 60 * 1000);
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
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'template';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 });
    }

    const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf', '.cdr', '.psd', '.ai'];
    const fileExtension = path.extname(file.name).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed formats: PNG, JPG, WEBP, SVG, PDF, CDR, PSD, AI.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // Sanitize SVG if necessary
    if (fileExtension === '.svg') {
      const rawSvg = buffer.toString('utf8');
      const cleanSvg = sanitizeSvg(rawSvg);
      buffer = Buffer.from(cleanSvg, 'utf8');
    }

    // Verify magic bytes
    const validateMagicBytes = (buf: Buffer, ext: string): boolean => {
      if (buf.length < 4) return false;
      if (ext === '.png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      if (ext === '.jpg' || ext === '.jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      if (ext === '.webp') return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
      if (ext === '.pdf') return buf.subarray(0, 4).toString('ascii') === '%PDF';
      if (ext === '.psd') return buf.subarray(0, 4).toString('ascii') === '8BPS';
      if (ext === '.svg') {
        const head = buf.subarray(0, 200).toString('utf8').trim().toLowerCase();
        return head.includes('<svg') || head.includes('<?xml');
      }
      return true;
    };

    if (!validateMagicBytes(buffer, fileExtension)) {
      return NextResponse.json({ error: 'File content does not match the claimed file extension.' }, { status: 400 });
    }

    // Determine Content-Type
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.psd': 'image/vnd.adobe.photoshop',
      '.ai': 'application/postscript',
      '.cdr': 'application/x-cdr',
    };
    const contentType = mimeTypes[fileExtension] || 'application/octet-stream';

    const uniqueHash = crypto.randomBytes(8).toString('hex');
    const keyPrefix = `press_${pressId}/${type}s/${Date.now()}-${uniqueHash}`;
    const mainKey = `${keyPrefix}${fileExtension}`;

    // Upload to Cloudflare R2 (or local fallback)
    const originalUrl = await uploadToR2({
      key: mainKey,
      body: buffer,
      contentType,
    });

    const isVectorOrPdf = fileExtension === '.pdf' || fileExtension === '.svg';
    let previewUrl = originalUrl;

    if (isVectorOrPdf && type === 'template') {
      const previewBuffer = await generatePreviewBuffer(buffer, fileExtension);
      if (previewBuffer) {
        const previewKey = `${keyPrefix}-preview.jpg`;
        previewUrl = await uploadToR2({
          key: previewKey,
          body: previewBuffer,
          contentType: 'image/jpeg',
        });
      }
    }

    return NextResponse.json({
      success: true,
      url: previewUrl,
      originalUrl,
      provider: isR2Configured ? 'r2' : 'local',
    });
  } catch (error: any) {
    console.error('Upload route error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
