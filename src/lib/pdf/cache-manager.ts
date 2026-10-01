import { prisma } from '../prisma';
import { renderCardSide, renderCardSideToPdfBytes } from './card-engine';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { CardAsset, CardTemplate, Cardholder, PressFont } from '@prisma/client';

export interface RenderedCard {
  frontBuffer: Buffer;
  backBuffer: Buffer;
  frontPdfBuffer?: Buffer;
  backPdfBuffer?: Buffer;
}

/**
 * Everything a PDF job needs that is the same for every card in it, read once
 * up front instead of per card. Built by createCardRenderContext() and handed
 * to getOrRenderCard() for each card, so a 1,000-card job issues a handful of
 * queries rather than five per card.
 */
export interface CardRenderContext {
  pressId: number;
  templateId: number;
  template: CardTemplate;
  templateHash: string;
  pressFonts: PressFont[];
  validTill: Date | null;
  cacheDir: string;
  isProd: boolean;
  isCloudinaryConfigured: boolean;
  /**
   * The job's cardholders keyed by id. An id missing from this map has no row
   * for this press, or is soft-deleted — callers skip that slot, which is what
   * the old per-card tenant-scoped lookup did by returning null.
   */
  cardholders: Map<number, Cardholder>;
  /**
   * CardAsset cache rows as of job start, kept up to date in place as cards are
   * re-rendered so a repeated cardholder (REPEAT_LAST padding) still hits cache.
   */
  assets: Map<number, CardAsset>;
}

// Read ids in chunks: the tenant extension caps an unbounded findMany at 5,000
// rows, and a single huge IN list would also push against the driver's
// bind-parameter limit. Chunking with an explicit `take` avoids both.
const ID_CHUNK_SIZE = 1000;

function chunkIds(ids: number[], size: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * Resolves the template, fonts, cardholders and cache rows for a whole PDF job.
 * Throws the same "Template #n not found" error the per-card path used to.
 */
export async function createCardRenderContext(
  pressId: number,
  templateId: number,
  validTill: Date | null,
  cardholderIds: number[]
): Promise<CardRenderContext> {
  const template = await prisma.cardTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new Error(`Template #${templateId} not found`);

  const pressFonts = await prisma.pressFont.findMany({
    where: {
      OR: [
        { pressId },
        { pressId: null }
      ]
    },
  });

  // Calculate current template layout hash to check if cache is stale
  const currentLayoutString = template.frontFields + template.backFields + template.frontImageUrl + (template.backImageUrl || '') + String(template.version || 1);
  const templateHash = crypto.createHash('sha256').update(currentLayoutString).digest('hex');

  // Grid generators pad unused slots with -1; those sentinels have no row.
  const ids = [...new Set(cardholderIds.filter((id) => id > 0))];

  const cardholders = new Map<number, Cardholder>();
  const assets = new Map<number, CardAsset>();

  for (const batch of chunkIds(ids, ID_CHUNK_SIZE)) {
    const [cardholderRows, assetRows] = await Promise.all([
      prisma.cardholder.findMany({
        where: { id: { in: batch } },
        take: batch.length,
      }),
      prisma.cardAsset.findMany({
        where: { cardholderId: { in: batch } },
        take: batch.length,
      }),
    ]);
    for (const row of cardholderRows) cardholders.set(row.id, row);
    for (const row of assetRows) assets.set(row.cardholderId, row);
  }

  // Use writeable /tmp in production environments to avoid EROFS errors
  const isProd = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
  const cacheDir = isProd
    ? path.join('/tmp', 'idexo', String(pressId), 'cache')
    : path.join(process.cwd(), 'public', 'uploads', String(pressId), 'cache');

  fs.mkdirSync(cacheDir, { recursive: true });

  const isCloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    pressId,
    templateId,
    template,
    templateHash,
    pressFonts,
    validTill,
    cacheDir,
    isProd,
    isCloudinaryConfigured,
    cardholders,
    assets,
  };
}

/**
 * Gets the rendered front and back card PNG and PDF buffers for a cardholder.
 * Uses CardAsset table as a caching layer to avoid re-rendering unless coordinates or student details change.
 *
 * Reads nothing from the database: the template, fonts and cache row all come
 * from the job's CardRenderContext. Only a cache miss writes (one upsert).
 */
export async function getOrRenderCard(
  ctx: CardRenderContext,
  cardholder: Cardholder
): Promise<RenderedCard> {
  const {
    pressId,
    templateId,
    template,
    templateHash,
    pressFonts,
    validTill,
    cacheDir,
    isProd,
    isCloudinaryConfigured,
  } = ctx;
  const cardholderId = cardholder.id;

  const cachedAsset = ctx.assets.get(cardholderId);

  const frontCachePath = path.join(cacheDir, `${cardholderId}_front.png`);
  const backCachePath = path.join(cacheDir, `${cardholderId}_back.png`);
  const frontPdfCachePath = path.join(cacheDir, `${cardholderId}_front.pdf`);
  const backPdfCachePath = path.join(cacheDir, `${cardholderId}_back.pdf`);

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
    const chTime = (cardholder as any).updatedAt || cardholder.createdAt;
    if (chTime && cachedAsset.generatedAt) {
      if (new Date(chTime).getTime() <= new Date(cachedAsset.generatedAt).getTime()) {
        useCache = true;
      }
    } else {
      useCache = true;
    }
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

  // Render cards dynamically
  const frontBuffer = await renderCardSide(template, cardholder, 'front', validTill, pressFonts);
  const backBuffer = await renderCardSide(template, cardholder, 'back', validTill, pressFonts);

  // Pass original URLs so the PDF renderer can embed the vector background directly
  const templateWithOriginals = {
    ...template,
    frontOriginalUrl: (template as any).frontOriginalUrl ?? null,
    backOriginalUrl: (template as any).backOriginalUrl ?? null,
  };
  const frontPdfBuffer = await renderCardSideToPdfBytes(templateWithOriginals, cardholder, 'front', validTill, pressFonts);
  const backPdfBuffer = await renderCardSideToPdfBytes(templateWithOriginals, cardholder, 'back', validTill, pressFonts);

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

  // Update or create the CardAsset cache record
  const asset = await prisma.cardAsset.upsert({
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
  // Keep the context current so a repeated cardholder in this job hits cache.
  ctx.assets.set(cardholderId, asset);

  return { frontBuffer, backBuffer, frontPdfBuffer, backPdfBuffer };
}
