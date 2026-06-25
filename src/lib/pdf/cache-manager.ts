import { prisma } from '../prisma';
import { renderCardSide, renderCardSideToPdfBytes } from './card-engine';
import md5 from 'md5';
import fs from 'fs';
import path from 'path';

export interface RenderedCard {
  frontBuffer: Buffer;
  backBuffer: Buffer;
  frontPdfBuffer?: Buffer;
  backPdfBuffer?: Buffer;
}

/**
 * Gets the rendered front and back card PNG and PDF buffers for a cardholder.
 * Uses CardAsset table as a caching layer to avoid re-rendering unless coordinates or student details change.
 */
export async function getOrRenderCard(
  pressId: number,
  cardholderId: number,
  templateId: number,
  validTill: Date | null
): Promise<RenderedCard> {
  // 1. Fetch current template and cardholder data
  const template = await prisma.cardTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new Error(`Template #${templateId} not found`);

  const cardholder = await prisma.cardholder.findUnique({
    where: { id: cardholderId },
  });
  if (!cardholder) throw new Error(`Cardholder #${cardholderId} not found`);

  const pressFonts = await prisma.pressFont.findMany({
    where: { pressId },
  });

  // Calculate current template layout hash to check if cache is stale
  const currentLayoutString = template.frontFields + template.backFields + template.frontImageUrl + (template.backImageUrl || '');
  const templateHash = md5(currentLayoutString);

  // 2. Query cache entry
  const cachedAsset = await prisma.cardAsset.findUnique({
    where: { cardholderId },
  });

  // Use writeable /tmp in production environments to avoid EROFS errors
  const isProd = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const cacheDir = isProd
    ? path.join('/tmp', 'idexo', String(pressId), 'cache')
    : path.join(process.cwd(), 'public', 'uploads', String(pressId), 'cache');
  
  fs.mkdirSync(cacheDir, { recursive: true });

  const frontCachePath = path.join(cacheDir, `${cardholderId}_front.png`);
  const backCachePath = path.join(cacheDir, `${cardholderId}_back.png`);
  const frontPdfCachePath = path.join(cacheDir, `${cardholderId}_front.pdf`);
  const backPdfCachePath = path.join(cacheDir, `${cardholderId}_back.pdf`);

  const isCloudinaryConfigured = 
    process.env.CLOUDINARY_CLOUD_NAME && 
    process.env.CLOUDINARY_API_KEY && 
    process.env.CLOUDINARY_API_SECRET;

  let useCache = false;

  if (
    cachedAsset &&
    !cachedAsset.isStale &&
    cachedAsset.templateHash === templateHash &&
    cachedAsset.templateId === templateId &&
    fs.existsSync(frontCachePath) &&
    fs.existsSync(backCachePath) &&
    fs.existsSync(frontPdfCachePath) &&
    fs.existsSync(backPdfCachePath)
  ) {
    useCache = true;
  }

  if (useCache && cachedAsset) {
    try {
      const frontBuffer = fs.readFileSync(frontCachePath);
      const backBuffer = fs.readFileSync(backCachePath);
      const frontPdfBuffer = fs.readFileSync(frontPdfCachePath);
      const backPdfBuffer = fs.readFileSync(backPdfCachePath);
      return { frontBuffer, backBuffer, frontPdfBuffer, backPdfBuffer };
    } catch (err) {
      console.warn(`Failed reading cache files for cardholder #${cardholderId}, regenerating...`, err);
    }
  }

  // 3. Render cards dynamically
  const frontBuffer = await renderCardSide(template, cardholder, 'front', validTill, pressFonts);
  const backBuffer = await renderCardSide(template, cardholder, 'back', validTill, pressFonts);
  const frontPdfBuffer = await renderCardSideToPdfBytes(template, cardholder, 'front', validTill, pressFonts);
  const backPdfBuffer = await renderCardSideToPdfBytes(template, cardholder, 'back', validTill, pressFonts);

  // Save to local cache path (writeable even in serverless if in /tmp)
  fs.writeFileSync(frontCachePath, frontBuffer);
  fs.writeFileSync(backCachePath, backBuffer);
  fs.writeFileSync(frontPdfCachePath, frontPdfBuffer);
  fs.writeFileSync(backPdfCachePath, backPdfBuffer);

  let frontUrl = '';
  let backUrl = '';

  if (isCloudinaryConfigured) {
    const { v2: cloudinary } = require('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const uploadToCloudinary = async (buffer: Buffer, filename: string): Promise<string> => {
      const uploadResult = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: `press_${pressId}/cache`,
            public_id: filename,
            overwrite: true,
            resource_type: 'image',
          },
          (error: any, result: any) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(buffer);
      });
      return uploadResult.secure_url;
    };

    try {
      frontUrl = await uploadToCloudinary(frontBuffer, `${cardholderId}_front`);
      backUrl = await uploadToCloudinary(backBuffer, `${cardholderId}_back`);
    } catch (err) {
      console.error('Failed to upload cached PNGs to Cloudinary:', err);
      // Fallback relative urls
      frontUrl = `/uploads/${pressId}/cache/${cardholderId}_front.png`;
      backUrl = `/uploads/${pressId}/cache/${cardholderId}_back.png`;
    }
  } else {
    // If not using Cloudinary and not in prod, copy to public uploads so browser can load it.
    // Note: in a true read-only serverless without Cloudinary, browser preview fallback won't work,
    // but this prevents application crash during PDF generation by utilizing /tmp above.
    if (!isProd) {
      frontUrl = `/uploads/${pressId}/cache/${cardholderId}_front.png`;
      backUrl = `/uploads/${pressId}/cache/${cardholderId}_back.png`;
    } else {
      // In production serverless without Cloudinary, preview is not accessible but we set it
      frontUrl = `/uploads/${pressId}/cache/${cardholderId}_front.png`;
      backUrl = `/uploads/${pressId}/cache/${cardholderId}_back.png`;
    }
  }

  // 4. Update or create the CardAsset cache record
  await prisma.cardAsset.upsert({
    where: { cardholderId },
    update: {
      templateId,
      frontUrl,
      backUrl,
      templateHash,
      isStale: false,
      generatedAt: new Date(),
    },
    create: {
      cardholderId,
      pressId,
      templateId,
      frontUrl,
      backUrl,
      templateHash,
      isStale: false,
    },
  });

  return { frontBuffer, backBuffer, frontPdfBuffer, backPdfBuffer };
}
