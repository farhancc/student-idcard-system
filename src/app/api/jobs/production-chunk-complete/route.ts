import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const chunkCompleteSchema = z.object({
  jobId: z.union([z.number(), z.string().transform(Number)]),
  chunkIndex: z.number(),
  totalChunks: z.number(),
  pdfBase64: z.string().optional(),
  localPath: z.string().optional(),
  fileName: z.string(),
});

export async function POST(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const validation = chunkCompleteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request parameters', details: validation.error.format() }, { status: 400 });
    }

    const { jobId, chunkIndex, totalChunks, pdfBase64, localPath, fileName } = validation.data;

    // Verify the job belongs to this press
    const job = await prisma.pdfJob.findFirst({
      where: { id: Number(jobId), pressId },
    });
    if (!job) {
      return NextResponse.json({ error: 'PDF Job not found' }, { status: 404 });
    }

    let downloadUrl = '';

    if (pdfBase64) {
      try {
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const isCloudinaryConfigured = !!(
          process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET
        );

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
                folder: `press_${pressId}/compiled_pdfs`,
                resource_type: 'raw',
                public_id: fileName,
              },
              (err: any, res: any) => {
                if (err) reject(err);
                else resolve(res);
              }
            ).end(pdfBuffer);
          });
          downloadUrl = uploadResult.secure_url;
        } else {
          const isProd = process.env.VERCEL || process.env.NODE_ENV === 'production';
          const fs = require('fs');
          const path = require('path');
          const pdfDir = isProd
            ? path.join('/tmp', 'idexo', 'uploads', String(pressId), 'pdfs')
            : path.join(process.cwd(), 'public', 'uploads', String(pressId), 'pdfs');
          fs.mkdirSync(pdfDir, { recursive: true });

          const filePath = path.join(pdfDir, fileName);
          fs.writeFileSync(filePath, pdfBuffer);
          downloadUrl = `/uploads/${pressId}/pdfs/${fileName}`;
        }
      } catch (uploadErr) {
        console.error('Failed to save chunk PDF on server storage:', uploadErr);
      }
    }

    if (!downloadUrl && localPath) {
      const formattedPath = localPath.replace(/\\\\/g, '/');
      const prefix = (formattedPath.startsWith('/') || !/^[a-zA-Z]:/.test(formattedPath)) ? '' : '/';
      downloadUrl = `local://${prefix}${formattedPath}`;
    }

    // Create the chunk record
    const chunk = await prisma.pdfJobChunk.create({
      data: {
        pdfJobId: Number(jobId),
        chunkIndex,
        totalChunks,
        fileName,
        downloadUrl: downloadUrl || null,
        localPath: localPath || null,
        fileSize: pdfBase64 ? Math.ceil(pdfBase64.length * 0.75) : null,
      },
    });

    return NextResponse.json({
      success: true,
      chunkId: chunk.id,
      chunkIndex,
      downloadUrl,
    });
  } catch (error: unknown) {
    console.error('Chunk complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
