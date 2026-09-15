import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * These tests pin the invariants that the previous retention code got wrong:
 * unbounded date ranges, RESTRICT-violating delete order, hard-deleted orders,
 * leaked R2 objects, and purging records that were never backed up.
 */

interface RecordedCall {
  model: string;
  op: string;
  args: any;
}

// Hoisted: vi.mock factories run before module-level consts are initialised.
const { calls, fixtures, results, deleteManyFromR2 } = vi.hoisted(() => {
  const calls: RecordedCall[] = [];

  const fixtures = {
    cardholderCount: 3,
    cardholders: [
      { id: 11, photoUrl: 'https://cdn.test/press_1/photos/a.jpg' },
      { id: 12, photoUrl: null },
      { id: 13, photoUrl: 'https://cdn.test/press_1/photos/c.jpg' },
    ],
    cardAssets: [
      {
        frontUrl: 'https://cdn.test/press_1/cards/11-front.png',
        backUrl: 'https://cdn.test/press_1/cards/11-back.png',
      },
    ],
    orders: [{ id: 501 }, { id: 502 }],
    // 501 is fully covered by the default batch; 502 keeps member 99, which is
    // never in scope, so 502 must survive every purge below.
    orderCardholders: [
      { orderId: 501, cardholderId: 11 },
      { orderId: 501, cardholderId: 12 },
      { orderId: 501, cardholderId: 13 },
      { orderId: 502, cardholderId: 13 },
      { orderId: 502, cardholderId: 99 },
    ],
    pdfJobs: [{ id: 901, downloadUrl: 'https://cdn.test/press_1/pdfs/order-501.pdf' }],
    chunks: [{ downloadUrl: 'https://cdn.test/press_1/pdfs/order-501-chunk-1.pdf' }],
  };

  const results = (model: string, op: string, args?: any): any => {
    if (model === 'cardholder' && op === 'count') return fixtures.cardholderCount;
    if (model === 'cardholder' && op === 'findMany') return fixtures.cardholders;
    if (model === 'cardAsset') return fixtures.cardAssets;
    // These two must respect their `where`, or the order-scoping assertions
    // below would pass against a mock that ignores the filters under test.
    if (model === 'orderCardholder' && op === 'findMany') {
      const w = args?.where ?? {};
      return fixtures.orderCardholders.filter((l: any) => {
        if (w.cardholderId?.in && !w.cardholderId.in.includes(l.cardholderId)) return false;
        if (w.cardholderId?.notIn && w.cardholderId.notIn.includes(l.cardholderId)) return false;
        if (w.orderId?.in && !w.orderId.in.includes(l.orderId)) return false;
        return true;
      });
    }
    if (model === 'cardOrder' && op === 'findMany') {
      const ids = args?.where?.id?.in;
      return ids ? fixtures.orders.filter((o: any) => ids.includes(o.id)) : fixtures.orders;
    }
    if (model === 'pdfJob' && op === 'findMany') return fixtures.pdfJobs;
    if (model === 'pdfJobChunk') return fixtures.chunks;
    if (model === 'client') return [{ id: 7, name: 'Acme' }];
    if (op === 'deleteMany' || op === 'updateMany') return { count: 1 };
    return [];
  };

  const deleteManyFromR2 = vi.fn(async (keys: string[]) => ({
    deleted: keys.length,
    failed: [] as string[],
  }));

  return { calls, fixtures, results, deleteManyFromR2 };
});

vi.mock('@/lib/prisma', () => {
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, op: string) => (args: any) => {
          calls.push({ model: name, op, args });
          const value = results(name, op, args);
          return Promise.resolve(
            Array.isArray(value) && typeof args?.take === 'number' ? value.slice(0, args.take) : value
          );
        },
      }
    );

  const basePrisma = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (prop === '$transaction') return (ops: Promise<any>[]) => Promise.all(ops);
        return model(prop);
      },
    }
  );

  return { basePrisma, prisma: basePrisma };
});

vi.mock('@/lib/storage', () => ({ deleteManyFromR2 }));

import {
  PURGE_BATCH_LIMIT,
  collectPurgeTargets,
  executePurge,
  hashCardholderIds,
  signPurgeToken,
  verifyPurgeToken,
} from '@/lib/retention';

const scope = {
  pressId: 1,
  clientIds: [7],
  from: new Date('2025-01-01T00:00:00.000Z'),
  to: new Date('2025-06-30T23:59:59.999Z'),
};

beforeEach(() => {
  calls.length = 0;
  deleteManyFromR2.mockClear();
});

describe('collectPurgeTargets', () => {
  it('collects the R2 objects nothing else in the system ever deleted', async () => {
    const targets = await collectPurgeTargets(scope);

    // Regression: card asset faces and PDF chunk files used to be cascade-dropped
    // from the DB and orphaned in R2 forever.
    expect(targets.r2Keys).toContain('https://cdn.test/press_1/cards/11-front.png');
    expect(targets.r2Keys).toContain('https://cdn.test/press_1/cards/11-back.png');
    expect(targets.r2Keys).toContain('https://cdn.test/press_1/pdfs/order-501-chunk-1.pdf');
    expect(targets.r2Keys).toContain('https://cdn.test/press_1/pdfs/order-501.pdf');
    expect(targets.r2Keys).toContain('https://cdn.test/press_1/photos/a.jpg');
  });

  it('never leaves the date range open-ended', async () => {
    await collectPurgeTargets(scope);

    // The old backup/purge filtered on `createdAt <= endDate` alone, which reached
    // back through all prior history while only one month had been backed up.
    const ranged = calls.filter((c) => c.args?.where?.createdAt);
    expect(ranged.length).toBeGreaterThan(0);
    for (const call of ranged) {
      expect(call.args.where.createdAt.gte).toEqual(scope.from);
      expect(call.args.where.createdAt.lte).toEqual(scope.to);
    }
  });

  it('scopes every tenant-owned query to the press', async () => {
    await collectPurgeTargets(scope);

    // basePrisma bypasses the tenant extension, so scoping is this module's job.
    const tenantModels = ['cardholder', 'cardAsset', 'cardOrder', 'pdfJob'];
    const scoped = calls.filter((c) => tenantModels.includes(c.model));
    expect(scoped.length).toBeGreaterThan(0);
    for (const call of scoped) {
      expect(call.args.where.pressId).toBe(1);
    }

    // Chunks have no pressId column; they are reached only via their parent jobs.
    const chunkCalls = calls.filter((c) => c.model === 'pdfJobChunk');
    expect(chunkCalls[0].args.where.pdfJobId.in).toEqual([901]);
  });

  it('applies the default batch limit', async () => {
    const targets = await collectPurgeTargets(scope);
    const findMany = calls.find((c) => c.model === 'cardholder' && c.op === 'findMany');

    expect(findMany!.args.take).toBe(PURGE_BATCH_LIMIT);
    expect(findMany!.args.orderBy).toEqual({ createdAt: 'asc' }); // oldest first, so batches drain
    expect(targets.cardholderIds).toEqual([11, 12, 13]);
    expect(targets.hasMore).toBe(false);
  });

  it('reports the remainder instead of silently truncating', async () => {
    const targets = await collectPurgeTargets(scope, { limit: 2 });

    expect(calls.find((c) => c.model === 'cardholder' && c.op === 'findMany')!.args.take).toBe(2);
    expect(targets.totalInScope).toBe(3);
    expect(targets.cardholderIds).toEqual([11, 12]);
    expect(targets.hasMore).toBe(true);
  });

  it('sweeps only the orders this batch fully drains', async () => {
    const targets = await collectPurgeTargets(scope);

    // 501's every member is in the batch, so it can be archived. 502 still holds
    // cardholder 99 and must be left alone.
    expect(targets.orderIds).toEqual([501]);

    const orderQuery = calls.find((c) => c.model === 'cardOrder' && c.op === 'findMany');
    expect(orderQuery!.args.where.id.in).toEqual([501, 502]);
  });

  it('leaves an order live while the batch drains only part of it', async () => {
    // The batch-limit case: cardholder 13 is beyond this batch, so order 501 is
    // still serving a live card. Archiving it here — and destroying its PDF jobs
    // and R2 objects — is the defect this pins.
    const targets = await collectPurgeTargets(scope, { limit: 2 });

    expect(targets.cardholderIds).toEqual([11, 12]);
    expect(targets.orderIds).toEqual([]);
    expect(targets.counts.pdfJobs).toBe(0);
    expect(targets.r2Keys).not.toContain('https://cdn.test/press_1/pdfs/order-501.pdf');
    expect(targets.r2Keys).not.toContain('https://cdn.test/press_1/pdfs/order-501-chunk-1.pdf');

    // The cardholders' own blobs are still reclaimed.
    expect(targets.r2Keys).toContain('https://cdn.test/press_1/photos/a.jpg');
  });

  it('reaches orders only through the batch, and only inside the window', async () => {
    await collectPurgeTargets(scope, { cardholderIds: [11], limit: 1 });

    // A purge authorised for one cardholder must not sweep the client's whole
    // date range, which is what the range-only query used to do.
    const orderQuery = calls.find((c) => c.model === 'cardOrder' && c.op === 'findMany')!;
    expect(orderQuery.args.where.id.in).toEqual([501]);
    expect(orderQuery.args.where.createdAt.gte).toEqual(scope.from);
    expect(orderQuery.args.where.createdAt.lte).toEqual(scope.to);
    expect(orderQuery.args.where.pressId).toBe(1);
  });

  it('returns nothing when no clients are named', async () => {
    const targets = await collectPurgeTargets({ ...scope, clientIds: [] });
    expect(targets.cardholderIds).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('executePurge', () => {
  it('clears RESTRICT-protected join rows before deleting cardholders', async () => {
    const targets = await collectPurgeTargets(scope);
    calls.length = 0;
    await executePurge(targets);

    const order = calls.map((c) => `${c.model}.${c.op}`);
    const joinIdx = order.indexOf('orderCardholder.deleteMany');
    const cardholderIdx = order.indexOf('cardholder.deleteMany');

    // order_cardholders has ON DELETE RESTRICT on cardholder_id: deleting the
    // cardholder first throws and aborts the whole batch.
    expect(joinIdx).toBeGreaterThanOrEqual(0);
    expect(cardholderIdx).toBeGreaterThanOrEqual(0);
    expect(joinIdx).toBeLessThan(cardholderIdx);
  });

  it('archives orders instead of destroying them, preserving invoices', async () => {
    const targets = await collectPurgeTargets(scope);
    calls.length = 0;
    await executePurge(targets);

    const orderOps = calls.filter((c) => c.model === 'cardOrder');
    expect(orderOps.map((c) => c.op)).toEqual(['updateMany']);
    expect(orderOps[0].args.data.deletedAt).toBeInstanceOf(Date);

    // Invoices, delivery records and activity logs must never be touched.
    for (const model of ['orderInvoice', 'deliveryRecord', 'orderActivityLog']) {
      expect(calls.some((c) => c.model === model)).toBe(false);
    }
  });

  it('reclaims storage after the database commits', async () => {
    const targets = await collectPurgeTargets(scope);
    const result = await executePurge(targets);

    expect(deleteManyFromR2).toHaveBeenCalledWith(targets.r2Keys);
    expect(result.filesDeleted).toBe(targets.r2Keys.length);
  });

  it('does nothing when there is nothing in scope', async () => {
    const empty = await collectPurgeTargets({ ...scope, clientIds: [] });
    calls.length = 0;
    const result = await executePurge(empty);

    expect(calls).toHaveLength(0);
    expect(deleteManyFromR2).not.toHaveBeenCalled();
    expect(result.cardholdersDeleted).toBe(0);
  });
});

describe('purge authorisation token', () => {
  const claims = {
    pressId: 1,
    clientIds: [7],
    from: scope.from.toISOString(),
    to: scope.to.toISOString(),
    idsHash: hashCardholderIds([11, 12]),
  };

  it('authorises exactly the exported id set', async () => {
    const token = await signPurgeToken(claims);
    const verified = await verifyPurgeToken(token, 1, [12, 11]); // order must not matter

    expect(verified).not.toBeNull();
    expect(verified!.clientIds).toEqual([7]);
    expect(verified!.from).toEqual(scope.from);
  });

  it('refuses ids the backup did not contain', async () => {
    const token = await signPurgeToken(claims);

    // The record whose photo failed to archive is absent from the token, so it
    // cannot be destroyed however the caller asks.
    expect(await verifyPurgeToken(token, 1, [11, 12, 13])).toBeNull();
    expect(await verifyPurgeToken(token, 1, [11])).toBeNull();
  });

  it('refuses another tenant and refuses a forged token', async () => {
    const token = await signPurgeToken(claims);
    expect(await verifyPurgeToken(token, 2, [11, 12])).toBeNull();
    expect(await verifyPurgeToken(`${token}tampered`, 1, [11, 12])).toBeNull();
    expect(await verifyPurgeToken('not-a-token', 1, [11, 12])).toBeNull();
  });
});
