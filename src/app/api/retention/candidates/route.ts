import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { basePrisma } from '@/lib/prisma';
import {
  RETENTION_MONTHS,
  AVG_PHOTO_BYTES,
  AVG_CARD_ASSET_BYTES,
  retentionCutoff,
} from '@/lib/retention';

/**
 * Per-client summary of what a purge would cover, for the preview panel and the
 * automatic 6-month archive.
 *
 * Deliberately counts rather than loads. The route this replaces
 * (`/api/archive/expired`) selected every expired cardholder with four nested
 * includes on every dashboard mount, which is a large recurring DB cost for a
 * screen that only ever showed totals.
 */
export async function GET(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const { searchParams } = new URL(request.url);

    // Either an explicit range (manual purge) or "older than N months" (auto archive).
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const monthsParam = Number(searchParams.get('olderThanMonths') ?? RETENTION_MONTHS);

    const to = toParam ? new Date(toParam) : retentionCutoff(
      Number.isFinite(monthsParam) && monthsParam > 0 ? monthsParam : RETENTION_MONTHS
    );
    // Epoch is a safe lower bound *here* because this endpoint only counts.
    // The purge itself always receives both bounds from its signed token.
    const from = fromParam ? new Date(fromParam) : new Date(0);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Invalid from/to date' }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json({ error: '`from` must be before `to`' }, { status: 400 });
    }

    const createdAt = { gte: from, lte: to };

    const grouped = await basePrisma.cardholder.groupBy({
      by: ['clientId'],
      where: { pressId, createdAt },
      _count: { _all: true },
    });

    if (grouped.length === 0) {
      return NextResponse.json({ success: true, from, to, clients: [] });
    }

    const clientIds = grouped.map((g: { clientId: number }) => g.clientId);

    // Names for display, and photo counts so the size estimate is not pure guesswork.
    const [clients, withPhotos] = await Promise.all([
      basePrisma.client.findMany({
        where: { pressId, id: { in: clientIds } },
        select: { id: true, name: true },
      }),
      basePrisma.cardholder.groupBy({
        by: ['clientId'],
        where: { pressId, createdAt, photoUrl: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const nameById = new Map<number, string>(
      clients.map((c: { id: number; name: string }) => [c.id, c.name])
    );
    const photosById = new Map<number, number>(
      withPhotos.map((g: { clientId: number; _count: { _all: number } }) => [g.clientId, g._count._all])
    );

    const result = grouped
      .map((g: { clientId: number; _count: { _all: number } }) => {
        const records = g._count._all;
        const photos = photosById.get(g.clientId) ?? 0;
        return {
          clientId: g.clientId,
          clientName: nameById.get(g.clientId) ?? 'Unknown Client',
          records,
          photos,
          // Each cardholder also carries a rendered front+back in R2.
          estimatedBytes: photos * AVG_PHOTO_BYTES + records * AVG_CARD_ASSET_BYTES,
        };
      })
      .sort((a: { records: number }, b: { records: number }) => b.records - a.records);

    return NextResponse.json({ success: true, from, to, clients: result });
  } catch (error: unknown) {
    console.error('Retention candidates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
