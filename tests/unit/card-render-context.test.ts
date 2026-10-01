import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * PDF generation used to issue five queries per card: the generator fetched the
 * cardholder, then getOrRenderCard re-fetched that same cardholder plus the
 * template, the press fonts and the cache row — the first three identical on
 * every iteration. These tests pin the batched replacement: the per-job reads
 * happen once, the per-card path reads nothing, and the cache-hit decision and
 * template hash are unchanged (a changed hash would invalidate every cached
 * card in production).
 */

// Force the /tmp cache branch so the test never writes into ./public.
process.env.VERCEL = '1';

type Call = string;
const calls: Call[] = [];

let templateRow: any;
let cardholderRows: any[];
let assetRows: any[];

const prismaMock = {
  cardTemplate: {
    findUnique: vi.fn(async (_args: any) => {
      calls.push('cardTemplate.findUnique');
      return templateRow;
    }),
  },
  pressFont: {
    findMany: vi.fn(async (_args: any) => {
      calls.push('pressFont.findMany');
      return [{ id: 1, pressId: null, name: 'Inter' }];
    }),
  },
  cardholder: {
    findMany: vi.fn(async (args: any) => {
      calls.push('cardholder.findMany');
      const ids: number[] = args.where.id.in;
      return cardholderRows.filter((c) => ids.includes(c.id));
    }),
  },
  cardAsset: {
    findMany: vi.fn(async (args: any) => {
      calls.push('cardAsset.findMany');
      const ids: number[] = args.where.cardholderId.in;
      return assetRows.filter((a) => ids.includes(a.cardholderId));
    }),
    upsert: vi.fn(async (args: any) => {
      calls.push('cardAsset.upsert');
      return {
        id: 500 + args.where.cardholderId,
        cardholderId: args.where.cardholderId,
        pressId: 7,
        templateId: args.update.templateId,
        frontUrl: args.update.frontUrl,
        backUrl: args.update.backUrl,
        templateHash: args.update.templateHash,
        isStale: false,
        generatedAt: args.update.generatedAt,
      };
    }),
  },
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('../prisma', () => ({ prisma: prismaMock }));

const renderCalls: string[] = [];
vi.mock('@/lib/pdf/card-engine', () => ({
  renderCardSide: async (_t: any, ch: any, side: string) => {
    renderCalls.push(`png:${ch.id}:${side}`);
    return Buffer.from(`png-${ch.id}-${side}`);
  },
  renderCardSideToPdfBytes: async (_t: any, ch: any, side: string) => {
    renderCalls.push(`pdf:${ch.id}:${side}`);
    return Buffer.from(`pdf-${ch.id}-${side}`);
  },
}));

const { createCardRenderContext, getOrRenderCard } = await import('@/lib/pdf/cache-manager');

const PRESS_ID = 7;
const TEMPLATE_ID = 42;
const cacheDir = path.join('/tmp', 'idexo', String(PRESS_ID), 'cache');

function makeTemplate(over: any = {}) {
  return {
    id: TEMPLATE_ID,
    pressId: PRESS_ID,
    frontFields: '[{"field":"name"}]',
    backFields: '[]',
    frontImageUrl: 'https://cdn/front.png',
    backImageUrl: 'https://cdn/back.png',
    version: 3,
    cardWidth: 1011,
    cardHeight: 638,
    ...over,
  };
}

function makeCardholder(id: number, over: any = {}) {
  return {
    id,
    pressId: PRESS_ID,
    name: `Student ${id}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

/** The hash formula as it shipped — cached cards depend on it byte for byte. */
function legacyHash(t: any) {
  const s = t.frontFields + t.backFields + t.frontImageUrl + (t.backImageUrl || '') + String(t.version || 1);
  return crypto.createHash('sha256').update(s).digest('hex');
}

beforeEach(() => {
  calls.length = 0;
  renderCalls.length = 0;
  templateRow = makeTemplate();
  cardholderRows = [1, 2, 3, 4, 5].map((id) => makeCardholder(id));
  assetRows = [];
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

afterAll(() => {
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

describe('createCardRenderContext', () => {
  it('reads the per-job data exactly once regardless of card count', async () => {
    await createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1, 2, 3, 4, 5]);

    expect(calls).toEqual([
      'cardTemplate.findUnique',
      'pressFont.findMany',
      'cardholder.findMany',
      'cardAsset.findMany',
    ]);
  });

  it('batches cardholder and asset reads with an explicit take, so the 5000-row cap cannot truncate a job', async () => {
    await createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1, 2, 3]);

    const chArgs = prismaMock.cardholder.findMany.mock.calls.at(-1)![0] as any;
    const asArgs = prismaMock.cardAsset.findMany.mock.calls.at(-1)![0] as any;
    expect(chArgs.where.id.in).toEqual([1, 2, 3]);
    expect(chArgs.take).toBe(3);
    expect(asArgs.where.cardholderId.in).toEqual([1, 2, 3]);
    expect(asArgs.take).toBe(3);
  });

  it('drops blank-slot sentinels and duplicate ids before querying', async () => {
    // Production grid pads unused slots with -1 and REPEAT_LAST repeats an id.
    const ctx = await createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1, 2, 2, -1, -1, 3]);

    const chArgs = prismaMock.cardholder.findMany.mock.calls.at(-1)![0] as any;
    expect(chArgs.where.id.in).toEqual([1, 2, 3]);
    expect(ctx.cardholders.size).toBe(3);
  });

  it('omits cardholders the tenant-scoped read did not return, so generators skip that slot', async () => {
    cardholderRows = [makeCardholder(1), makeCardholder(3)]; // 2 absent or soft-deleted
    const ctx = await createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1, 2, 3]);

    expect(ctx.cardholders.get(1)).toBeTruthy();
    expect(ctx.cardholders.get(2)).toBeUndefined();
    expect(ctx.cardholders.get(3)).toBeTruthy();
  });

  it('computes the same template hash as the per-card version did', async () => {
    const ctx = await createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1]);
    expect(ctx.templateHash).toBe(legacyHash(templateRow));
  });

  it('keeps the null-backImageUrl hash behaviour', async () => {
    templateRow = makeTemplate({ backImageUrl: null });
    const ctx = await createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1]);
    expect(ctx.templateHash).toBe(legacyHash(templateRow));
  });

  it('throws the same error when the template is missing', async () => {
    templateRow = null;
    await expect(
      createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1])
    ).rejects.toThrow('Template #42 not found');
  });
});

describe('getOrRenderCard', () => {
  it('issues no reads per card — only one upsert on a cache miss', async () => {
    const ctx = await createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1, 2, 3, 4, 5]);
    calls.length = 0;

    for (const id of [1, 2, 3, 4, 5]) {
      await getOrRenderCard(ctx, ctx.cardholders.get(id)!);
    }

    expect(calls).toEqual(Array(5).fill('cardAsset.upsert'));
  });

  it('serves a fresh cache row from disk without rendering or writing', async () => {
    assetRows = [{
      id: 1,
      cardholderId: 1,
      pressId: PRESS_ID,
      templateId: TEMPLATE_ID,
      frontUrl: 'f',
      backUrl: 'b',
      templateHash: legacyHash(templateRow),
      isStale: false,
      generatedAt: new Date('2026-02-01T00:00:00Z'), // after cardholder.updatedAt
    }];
    fs.mkdirSync(cacheDir, { recursive: true });
    for (const f of ['1_front.png', '1_back.png', '1_front.pdf', '1_back.pdf']) {
      fs.writeFileSync(path.join(cacheDir, f), Buffer.from(f));
    }

    const ctx = await createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1]);
    calls.length = 0;

    const out = await getOrRenderCard(ctx, ctx.cardholders.get(1)!);

    expect(renderCalls).toEqual([]);
    expect(calls).toEqual([]);
    expect(out.frontBuffer.toString()).toBe('1_front.png');
  });

  it('re-renders when the cache row is stale, when the hash moved, and when the cardholder is newer', async () => {
    const base = {
      id: 1,
      cardholderId: 1,
      pressId: PRESS_ID,
      templateId: TEMPLATE_ID,
      frontUrl: 'f',
      backUrl: 'b',
      templateHash: legacyHash(templateRow),
      isStale: false,
      generatedAt: new Date('2026-02-01T00:00:00Z'),
    };
    const cases = [
      { ...base, isStale: true },
      { ...base, templateHash: 'stale-hash' },
      { ...base, templateId: 999 },
      { ...base, generatedAt: new Date('2025-01-01T00:00:00Z') }, // older than cardholder
    ];

    for (const row of cases) {
      renderCalls.length = 0;
      assetRows = [row];
      fs.mkdirSync(cacheDir, { recursive: true });
      for (const f of ['1_front.png', '1_back.png', '1_front.pdf', '1_back.pdf']) {
        fs.writeFileSync(path.join(cacheDir, f), Buffer.from(f));
      }

      const ctx = await createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1]);
      await getOrRenderCard(ctx, ctx.cardholders.get(1)!);

      expect(renderCalls).toHaveLength(4); // png + pdf, front + back
    }
  });

  it('renders a repeated cardholder once — the second slot hits the refreshed cache row', async () => {
    const ctx = await createCardRenderContext(PRESS_ID, TEMPLATE_ID, null, [1, 1, 1]);
    calls.length = 0;

    const ch = ctx.cardholders.get(1)!;
    await getOrRenderCard(ctx, ch);
    await getOrRenderCard(ctx, ch);
    await getOrRenderCard(ctx, ch);

    expect(calls).toEqual(['cardAsset.upsert']);
    expect(renderCalls).toHaveLength(4);
  });
});
