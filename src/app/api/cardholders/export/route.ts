import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { ZipArchive } from 'archiver';
import { z } from 'zod';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { readPhoto, photoEntryName, buildCardholderWorkbook } from '@/lib/cardholder-export';

export const runtime = 'nodejs';

/** Photos fetched in parallel. Keeps peak memory at ~8 images, not the whole batch. */
const FETCH_CONCURRENCY = 8;

/**
 * POST /api/cardholders/export
 *
 * Powers the "Export Excel" and "Download ZIP" buttons on the Cardholders
 * tab (per-template and unassigned tables) — a plain Excel roster, or that
 * plus every photo, for an arbitrary set of cardholders. A POST body rather
 * than a query string: a full template group can run into the hundreds of
 * ids, well past what's safe to put in a URL.
 */
const schema = z.object({
  cardholderIds: z.array(z.union([z.number(), z.string().transform(Number)])).min(1),
  format: z.enum(['xlsx', 'zip']),
  fileName: z.string().optional(),
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
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request parameters', details: validation.error.format() }, { status: 400 });
    }
    const { cardholderIds, format, fileName } = validation.data;

    const cardholders = await prisma.cardholder.findMany({
      where: { pressId, id: { in: cardholderIds } },
      select: {
        id: true, name: true, designation: true, cardSerial: true,
        photoUrl: true, customFields: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (cardholders.length === 0) {
      return NextResponse.json({ error: 'No matching cardholders found' }, { status: 404 });
    }

    const safeName = (fileName || 'cardholders').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'xlsx') {
      const buffer = await buildCardholderWorkbook(cardholders, new Map(), false);
      return new Response(buffer as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // format === 'zip': photos + the same workbook, streamed so memory doesn't
    // scale with the batch (mirrors src/app/api/retention/export/route.ts).
    const archive = new ZipArchive({ zlib: { level: 6 } });

    const build = (async () => {
      const photoEntry = new Map<number, string>();

      for (let i = 0; i < cardholders.length; i += FETCH_CONCURRENCY) {
        const chunk = cardholders.slice(i, i + FETCH_CONCURRENCY);
        const fetched = await Promise.all(
          chunk.map(async (ch) => ({
            ch,
            body: ch.photoUrl ? await readPhoto(ch.photoUrl) : null,
          }))
        );
        for (const { ch, body: photoBody } of fetched) {
          if (!ch.photoUrl || !photoBody) continue;
          const name = photoEntryName(ch.id, ch.name, ch.photoUrl);
          archive.append(photoBody, { name });
          photoEntry.set(ch.id, name);
        }
      }

      archive.append(await buildCardholderWorkbook(cardholders, photoEntry, true), { name: 'cardholders.xlsx' });
      await archive.finalize();
    })();

    build.catch((err) => {
      console.error('Cardholder export ZIP build error:', err);
      archive.destroy(err instanceof Error ? err : new Error(String(err)));
    });

    return new Response(Readable.toWeb(archive) as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    console.error('Cardholder export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
