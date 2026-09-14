import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { uploadToR2 } from '@/lib/storage';

// Photo Quality Validation (M4)
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

async function validatePhoto(buffer: Buffer): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const meta = await sharp(buffer).metadata();

    if (!meta.width || !meta.height) {
      errors.push('Could not read image dimensions.');
      return { valid: false, errors, warnings };
    }

    // Check minimum resolution: 300x300px (relaxed from 300x400px to support standard square photos and test assets)
    if (meta.width < 300 || meta.height < 300) {
      errors.push(`Image resolution too low: ${meta.width}x${meta.height}px. Minimum requirement is 300x300px.`);
    }

    // Check aspect ratio: portrait (3:4 = 0.75) ± 20%
    const ratio = meta.width / meta.height;
    if (ratio < 0.6 || ratio > 0.9) {
      warnings.push(`Aspect ratio is ${ratio.toFixed(2)}, standard portrait is 0.75 (3:4). Image might get stretched/cropped.`);
    }

    // Brightness check (simplified via average pixel value from stats)
    const stats = await sharp(buffer).stats();
    const avgBrightness = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / stats.channels.length;
    if (avgBrightness < 30) {
      warnings.push('Image appears extremely dark.');
    } else if (avgBrightness > 230) {
      warnings.push('Image appears washed out or extremely bright.');
    }
  } catch (error) {
    errors.push('Invalid image file format or corrupted file.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`import-photos:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many batch import requests. Please wait a few minutes.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  try {
    const formData = await request.formData();
    const orgToken = formData.get('orgToken') as string | null;
    const clientIdStr = formData.get('clientId');
    const file = formData.get('file') as File | null;
    const matchBy = formData.get('matchBy') || 'uniqueKey'; // uniqueKey | name

    let pressId: number;
    let clientId: number;

    if (orgToken) {
      const share = await prisma.clientPortalShare.findUnique({
        where: { orgToken },
      });
      if (!share || !share.active) {
        return NextResponse.json({ error: 'Unauthorized or invalid portal link' }, { status: 403 });
      }
      pressId = share.pressId;
      clientId = share.clientId;
    } else {
      const auth = requireActor(request);
      if ('response' in auth) return auth.response;
      pressId = auth.actor.pressId;
      if (!clientIdStr) {
        return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
      }
      clientId = Number(clientIdStr);
    }

    if (!file) {
      return NextResponse.json({ error: 'ZIP file is required' }, { status: 400 });
    }

    // Verify client
    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Read ZIP file buffer
    const zipBuffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    const results = {
      totalFound: 0,
      matched: 0,
      failedValidation: 0,
      unmatched: 0,
      details: [] as any[],
    };

    // Pre-fetch all cardholders for this client in 1 query to prevent N+1 queries
    const allCardholders = await prisma.cardholder.findMany({
      where: { clientId },
    });

    const cardholderByName = new Map<string, typeof allCardholders[0]>();
    for (const c of allCardholders) {
      cardholderByName.set(c.name.trim().toLowerCase(), c);
    }

    const findCardholderInMemory = (baseName: string) => {
      const lower = baseName.trim().toLowerCase();
      if (cardholderByName.has(lower)) {
        return cardholderByName.get(lower)!;
      }
      return allCardholders.find(c => {
        if (!c.customFields) return false;
        try {
          const parsed = typeof c.customFields === 'string' ? JSON.parse(c.customFields) : c.customFields;
          if (parsed) {
            return Object.values(parsed).some((v: any) =>
              String(v).trim().toLowerCase() === lower
            );
          }
        } catch {}
        return false;
      }) || null;
    };

    // Prepare upload directory: public/uploads/{pressId}/{clientId}/photos/
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', String(pressId), String(clientId), 'photos');
    fs.mkdirSync(uploadDir, { recursive: true });

    const pendingPhotoUpdates: Array<{ id: number; photoUrl: string }> = [];

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      const ext = path.extname(entry.entryName).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        continue;
      }

      results.totalFound++;
      const baseName = path.basename(entry.entryName, ext).trim();
      const imageBuffer = entry.getData();

      // Find matching cardholder in-memory
      const cardholder = findCardholderInMemory(baseName);

      if (!cardholder) {
        results.unmatched++;
        results.details.push({
          fileName: entry.entryName,
          status: 'UNMATCHED',
          message: `No cardholder found matching name or custom field value for "${baseName}".`,
        });
        continue;
      }

      // Perform photo validation (M4)
      const validation = await validatePhoto(imageBuffer);
      if (!validation.valid) {
        results.failedValidation++;
        results.details.push({
          fileName: entry.entryName,
          cardholderName: cardholder.name,
          status: 'FAILED_VALIDATION',
          errors: validation.errors,
          warnings: validation.warnings,
        });
        continue;
      }

      const key = `press_${pressId}/client_${clientId}/photos/${cardholder.id}${ext}`;
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

      const publicUrl = await uploadToR2({
        key,
        body: imageBuffer,
        contentType,
      });

      pendingPhotoUpdates.push({ id: cardholder.id, photoUrl: publicUrl });

      results.matched++;
      results.details.push({
        fileName: entry.entryName,
        cardholderName: cardholder.name,
        status: 'SUCCESS',
        warnings: validation.warnings,
        photoUrl: publicUrl,
      });
    }

    // Execute pending DB updates in a single transaction
    if (pendingPhotoUpdates.length > 0) {
      const updatedCardholderIds = pendingPhotoUpdates.map(u => u.id);
      await prisma.$transaction(async (tx) => {
        await Promise.all(pendingPhotoUpdates.map(update => 
          tx.cardholder.update({
            where: { id: update.id },
            data: { photoUrl: update.photoUrl },
          })
        ));
        await tx.cardAsset.updateMany({
          where: { cardholderId: { in: updatedCardholderIds } },
          data: { isStale: true },
        });
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalFiles: results.totalFound,
        matchedCount: results.matched,
        failedValidationCount: results.failedValidation,
        unmatchedCount: results.unmatched,
      },
      details: results.details,
    });
  } catch (error) {
    console.error('ZIP photo import error:', error);
    return NextResponse.json({ error: 'Internal server error during photo import' }, { status: 500 });
  }
}
