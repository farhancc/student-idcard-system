import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

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
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const formData = await request.formData();
    const clientIdStr = formData.get('clientId');
    const file = formData.get('file') as File | null;
    const matchBy = formData.get('matchBy') || 'uniqueKey'; // uniqueKey | name

    if (!clientIdStr || !file) {
      return NextResponse.json({ error: 'Client ID and ZIP file are required' }, { status: 400 });
    }
    const clientId = Number(clientIdStr);

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

    // Prepare upload directory: public/uploads/{pressId}/{clientId}/photos/
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', String(pressId), String(clientId), 'photos');
    fs.mkdirSync(uploadDir, { recursive: true });

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      const ext = path.extname(entry.entryName).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        continue;
      }

      results.totalFound++;
      const baseName = path.basename(entry.entryName, ext).trim();
      const imageBuffer = entry.getData();

      // Find matching cardholder
      let cardholder = null;
      if (matchBy === 'uniqueKey') {
        cardholder = await prisma.cardholder.findFirst({
          where: { clientId, uniqueKey: baseName },
        });
      } else {
        cardholder = await prisma.cardholder.findFirst({
          where: { clientId, name: { equals: baseName, mode: 'insensitive' } },
        });
      }

      if (!cardholder) {
        results.unmatched++;
        results.details.push({
          fileName: entry.entryName,
          status: 'UNMATCHED',
          message: `No cardholder found matching ${matchBy} "${baseName}".`,
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

      const isCloudinaryConfigured = 
        process.env.CLOUDINARY_CLOUD_NAME && 
        process.env.CLOUDINARY_API_KEY && 
        process.env.CLOUDINARY_API_SECRET;

      let publicUrl = '';

      if (isCloudinaryConfigured) {
        const { v2: cloudinary } = require('cloudinary');
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        const uploadResult = await new Promise<any>((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              folder: `press_${pressId}/client_${clientId}/photos`,
              resource_type: 'image',
              public_id: String(cardholder.id),
              overwrite: true,
            },
            (error: any, result: any) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(imageBuffer);
        });

        publicUrl = uploadResult.secure_url;
      } else {
        // Save file locally in upload directory
        const destFileName = `${cardholder.id}${ext}`;
        const destPath = path.join(uploadDir, destFileName);
        fs.writeFileSync(destPath, imageBuffer);

        // Save URL path relative to public/
        publicUrl = `/uploads/${pressId}/${clientId}/photos/${destFileName}`;
      }

      // Update Cardholder DB
      await prisma.cardholder.update({
        where: { id: cardholder.id },
        data: { photoUrl: publicUrl },
      });

      // Mark cache stale
      await prisma.cardAsset.updateMany({
        where: { cardholderId: cardholder.id },
        data: { isStale: true },
      });

      results.matched++;
      results.details.push({
        fileName: entry.entryName,
        cardholderName: cardholder.name,
        status: 'SUCCESS',
        warnings: validation.warnings,
        photoUrl: publicUrl,
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
