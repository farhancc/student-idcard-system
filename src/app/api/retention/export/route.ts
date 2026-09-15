import path from 'path';
import fs from 'fs/promises';
import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { ZipArchive } from 'archiver';
import ExcelJS from 'exceljs';
import { requireActor } from '@/lib/authz';
import { basePrisma } from '@/lib/prisma';
import { fetchPublicAsset, resolveWithinDir } from '@/lib/safe-fetch';
import {
  PURGE_BATCH_LIMIT,
  collectPurgeTargets,
  hashCardholderIds,
  signPurgeToken,
} from '@/lib/retention';

export const runtime = 'nodejs';

/** Photos fetched in parallel. Keeps peak memory at ~8 images, not the whole batch. */
const FETCH_CONCURRENCY = 8;

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

function photoExtension(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  return ext && IMAGE_EXTENSIONS.includes(ext) ? ext : 'jpg';
}

function photoEntryName(id: number, name: string, url: string): string {
  return `photos/${id}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.${photoExtension(url)}`;
}

/**
 * Read one cardholder photo.
 *
 * Local `/uploads/...` paths are read from disk rather than fetched over HTTP:
 * `fetchPublicAsset` blocks private addresses, so a loopback round trip to our
 * own dev server would be refused — and it would be a pointless hop in any case.
 */
async function readPhoto(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('/')) {
      const key = url.replace(/^\/(uploads\/)?/, '');
      const baseDir = path.join(process.cwd(), 'public', 'uploads');
      const resolved = resolveWithinDir(baseDir, key);
      if (!resolved) return null;
      return await fs.readFile(resolved);
    }
    const asset = await fetchPublicAsset(url, {
      allowedContentTypePrefixes: ['image/'],
    });
    return asset.body;
  } catch {
    return null;
  }
}

/**
 * Stream a backup ZIP (photos + Excel + manifest) for one client and date range.
 *
 * Replaces `/api/backup/prepare`, which base64-encoded whole ZIPs into a JSON
 * body. This streams real bytes, so memory does not scale with the batch, and it
 * fetches photos server-side instead of making the desktop client pull every
 * object back out of R2.
 *
 * The final entry, `manifest.json`, carries the ids that actually made it into
 * the archive plus a signed purge token. It is written last because the id set
 * is not known until every photo has been attempted — which is also why the
 * token cannot travel in a response header.
 */
export async function GET(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const { searchParams } = new URL(request.url);
    const clientId = Number(searchParams.get('clientId'));
    const from = new Date(searchParams.get('from') ?? 0);
    const to = new Date(searchParams.get('to') ?? '');

    if (!Number.isInteger(clientId) || clientId <= 0) {
      return NextResponse.json({ error: 'Missing or invalid clientId' }, { status: 400 });
    }
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Invalid from/to date' }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json({ error: '`from` must be before `to`' }, { status: 400 });
    }

    const client = await basePrisma.client.findFirst({
      where: { id: clientId, pressId },
      select: { id: true, name: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const scope = { pressId, clientIds: [clientId], from, to };
    const targets = await collectPurgeTargets(scope, { limit: PURGE_BATCH_LIMIT });

    if (targets.cardholderIds.length === 0) {
      return NextResponse.json({ error: 'Nothing to export in this range' }, { status: 404 });
    }

    const cardholders = await basePrisma.cardholder.findMany({
      where: { pressId, id: { in: targets.cardholderIds } },
      select: {
        id: true, name: true, designation: true, cardSerial: true,
        photoUrl: true, customFields: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const archive = new ZipArchive({ zlib: { level: 6 } });

    // Build the archive in the background while its bytes stream to the client.
    const build = (async () => {
      const exportedIds: number[] = [];
      const photoEntry = new Map<number, string>();

      for (let i = 0; i < cardholders.length; i += FETCH_CONCURRENCY) {
        const chunk = cardholders.slice(i, i + FETCH_CONCURRENCY);
        const fetched = await Promise.all(
          chunk.map(async (ch: { id: number; name: string; photoUrl: string | null }) => ({
            ch,
            body: ch.photoUrl ? await readPhoto(ch.photoUrl) : null,
          }))
        );

        for (const { ch, body } of fetched) {
          if (!ch.photoUrl) {
            // Nothing to lose — safe to purge.
            exportedIds.push(ch.id);
            continue;
          }
          if (!body) {
            // Photo could not be read. Leaving this id out of the manifest is
            // what stops the purge from destroying an unbacked-up record.
            console.error(`[Retention] Photo unavailable for cardholder ${ch.id}; excluded from purge set`);
            continue;
          }
          const name = photoEntryName(ch.id, ch.name, ch.photoUrl);
          archive.append(body, { name });
          photoEntry.set(ch.id, name);
          exportedIds.push(ch.id);
        }
      }

      archive.append(await buildWorkbook(cardholders, photoEntry), { name: 'cardholders.xlsx' });

      const token = await signPurgeToken({
        pressId,
        clientIds: [clientId],
        from: from.toISOString(),
        to: to.toISOString(),
        idsHash: hashCardholderIds(exportedIds),
      });

      archive.append(
        Buffer.from(
          JSON.stringify(
            {
              client: { id: client.id, name: client.name },
              range: { from: from.toISOString(), to: to.toISOString() },
              generatedAt: new Date().toISOString(),
              exportedIds,
              skipped: cardholders.length - exportedIds.length,
              remainingInScope: targets.totalInScope - cardholders.length,
              purgeToken: token,
            },
            null,
            2
          )
        ),
        { name: 'manifest.json' }
      );

      await archive.finalize();
    })();

    build.catch((err) => {
      console.error('Retention export build error:', err);
      archive.destroy(err instanceof Error ? err : new Error(String(err)));
    });

    const safeName = client.name.replace(/[^a-zA-Z0-9]/g, '_');
    const stamp = `${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}`;

    return new Response(Readable.toWeb(archive) as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}_${stamp}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    console.error('Retention export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Excel sheet of the batch, flagging any record whose photo could not be archived. */
async function buildWorkbook(
  cardholders: Array<{
    id: number; name: string; designation: string | null; cardSerial: string | null;
    photoUrl: string | null; customFields: string | null; createdAt: Date;
  }>,
  photoEntry: Map<number, string>
): Promise<Buffer> {
  const rows = cardholders.map((ch) => {
    const row: Record<string, string | number> = {
      ID: ch.id,
      Name: ch.name,
      Designation: ch.designation ?? '',
      'Card Serial': ch.cardSerial ?? '',
      'Date Added': ch.createdAt.toISOString(),
      'Photo File': ch.photoUrl
        ? photoEntry.get(ch.id) ?? 'MISSING — not archived, not purged'
        : 'None',
      'Original Photo URL': ch.photoUrl ?? '',
    };
    if (ch.customFields) {
      try {
        const parsed = JSON.parse(ch.customFields);
        if (parsed && typeof parsed === 'object') {
          for (const [key, val] of Object.entries(parsed)) {
            row[`Field: ${key}`] = val == null ? '' : String(val);
          }
        }
      } catch {
        /* a malformed custom-fields blob must not sink the whole backup */
      }
    }
    return row;
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cardholders');

  // Union of keys — custom fields vary per record, so the first row is not enough.
  const columns = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) columns.add(key);
  sheet.columns = Array.from(columns).map((key) => ({ header: key, key, width: 20 }));
  rows.forEach((row) => sheet.addRow(row));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
