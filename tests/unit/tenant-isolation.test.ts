import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  MIDDLEWARE_HEADERS,
  SIGNATURE_HEX_LENGTH,
  TenantScope,
  middlewareSigPayload,
} from '@/lib/middleware-context';

/**
 * These tests drive the REAL Prisma extension.
 *
 * The previous version of this file exercised a second, exported copy of the
 * filtering logic, which drifted from the extension it was supposed to describe
 * and so failed to notice that unscoped queries had started throwing. Here the
 * `$allOperations` hook the client is actually built with is captured at import
 * time and invoked directly.
 */

const requestHeaders = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => requestHeaders.get(k.toLowerCase()) ?? null }),
}));

type Hook = (a: {
  model: string;
  operation: string;
  args: any;
  query: (args: any) => Promise<any>;
}) => Promise<any>;

let hook: Hook;

vi.mock('@prisma/client', () => {
  const modelStub = () =>
    new Proxy({}, { get: () => (args: any) => Promise.resolve(args) });

  class PrismaClient {
    constructor() {
      return new Proxy(this, {
        get: (target, prop) => {
          if (prop === '$extends') {
            return (ext: any) => {
              hook = ext.query.$allModels.$allOperations;
              return target;
            };
          }
          if (typeof prop === 'string' && prop.startsWith('$')) return () => Promise.resolve(null);
          return modelStub();
        },
      });
    }
  }
  return { PrismaClient };
});

function signHeaders(userId: number, pressId: number, role: string, scope: TenantScope) {
  const secret = process.env.JWT_SECRET || 'dev-middleware-secret';
  const sig = crypto
    .createHmac('sha256', secret)
    .update(middlewareSigPayload({ userId, pressId, role, scope }))
    .digest('hex')
    .slice(0, SIGNATURE_HEX_LENGTH);

  requestHeaders.set(MIDDLEWARE_HEADERS.userId, String(userId));
  requestHeaders.set(MIDDLEWARE_HEADERS.pressId, String(pressId));
  requestHeaders.set(MIDDLEWARE_HEADERS.role, role);
  requestHeaders.set(MIDDLEWARE_HEADERS.scope, scope);
  requestHeaders.set(MIDDLEWARE_HEADERS.signature, sig);
}

/** Run an operation through the extension and return the args it forwarded. */
async function run(model: string, operation: string, args: any = { where: {} }) {
  let forwarded: any;
  await hook({
    model,
    operation,
    args,
    query: async a => {
      forwarded = a;
      return null;
    },
  });
  return forwarded;
}

let prismaModule: typeof import('@/lib/prisma');

beforeEach(async () => {
  requestHeaders.clear();
  vi.stubEnv('NODE_ENV', 'production');
  vi.resetModules();
  prismaModule = await import('@/lib/prisma');
  expect(hook, 'extension hook was captured at import').toBeTypeOf('function');
});

describe('unscoped access', () => {
  it('refuses a tenant-model query with no context at all', async () => {
    await expect(run('Cardholder', 'findMany')).rejects.toThrow(/TENANT ISOLATION/);
  });

  it('refuses a forged x-press-id that carries no valid signature', async () => {
    // Exactly what a client can send to a public route.
    requestHeaders.set(MIDDLEWARE_HEADERS.pressId, '99');
    await expect(run('Cardholder', 'findMany')).rejects.toThrow(/TENANT ISOLATION/);
  });

  it('refuses a signature that does not match the claimed press', async () => {
    signHeaders(1, 7, 'OWNER', 'tenant');
    requestHeaders.set(MIDDLEWARE_HEADERS.pressId, '99'); // tamper after signing
    await expect(run('Cardholder', 'findMany')).rejects.toThrow(/TENANT ISOLATION/);
  });

  it('leaves non-tenant models alone without a context', async () => {
    const args = await run('Press', 'findMany');
    expect(args.where.pressId).toBeUndefined();
  });
});

describe('signed tenant context', () => {
  beforeEach(() => signHeaders(1, 7, 'OWNER', 'tenant'));

  it('injects the tenant filter on reads', async () => {
    for (const model of ['Client', 'Cardholder', 'CardOrder', 'PdfJob']) {
      const args = await run(model, 'findFirst', { where: { name: 'x' } });
      expect(args.where.pressId, model).toBe(7);
      expect(args.where.name, model).toBe('x');
    }
  });

  it('injects the tenant on writes, and on both halves of an upsert', async () => {
    expect((await run('Client', 'create', { data: { name: 'x' } })).data.pressId).toBe(7);
    expect((await run('Client', 'update', { where: { id: 1 } })).where.pressId).toBe(7);
    expect((await run('Client', 'deleteMany', { where: {} })).where.pressId).toBe(7);

    const up = await run('Client', 'upsert', { where: { id: 1 }, create: {}, update: {} });
    expect(up.where.pressId).toBe(7);
    expect(up.create.pressId).toBe(7);
    expect(up.update.pressId).toBe(7);
  });

  it('uses buyerPressId for TemplatePurchase', async () => {
    const args = await run('TemplatePurchase', 'findMany');
    expect(args.where.buyerPressId).toBe(7);
    expect(args.where.pressId).toBeUndefined();
  });

  it('lets CardTemplate see global templates as well as its own', async () => {
    const args = await run('CardTemplate', 'findMany', { where: { isLatest: true } });
    expect(args.where.AND[1]).toEqual({ OR: [{ pressId: null }, { pressId: 7 }] });
  });

  it('hides soft-deleted rows unless asked', async () => {
    expect((await run('Client', 'findMany')).where.deletedAt).toBeNull();
    const explicit = await run('Client', 'findMany', { where: { deletedAt: { not: null } } });
    expect(explicit.where.deletedAt).toEqual({ not: null });
  });

  it('caps an unbounded findMany', async () => {
    expect((await run('Cardholder', 'findMany')).take).toBe(5000);
    expect((await run('Cardholder', 'findMany', { where: {}, take: 10 })).take).toBe(10);
  });

  it('does not touch non-tenant models', async () => {
    const args = await run('Press', 'findMany');
    expect(args.where.pressId).toBeUndefined();
  });
});

describe('signed system context', () => {
  it('skips tenant filtering when the middleware signed scope=system', async () => {
    signHeaders(1, 0, 'SUPERADMIN', 'system');
    const args = await run('Cardholder', 'findMany');
    expect(args.where.pressId).toBeUndefined();
  });

  it('cannot be asserted by an unsigned header', async () => {
    requestHeaders.set(MIDDLEWARE_HEADERS.scope, 'system');
    await expect(run('Cardholder', 'findMany')).rejects.toThrow(/TENANT ISOLATION/);
  });
});

describe('explicit context wrappers', () => {
  it('withPressContext overrides whatever the headers say', async () => {
    signHeaders(1, 7, 'OWNER', 'tenant');
    const args = await prismaModule.withPressContext(3, () => run('Cardholder', 'findMany'));
    expect(args.where.pressId).toBe(3);
  });

  it('withSystemContext runs unscoped', async () => {
    const args = await prismaModule.withSystemContext(() => run('Cardholder', 'findMany'));
    expect(args.where.pressId).toBeUndefined();
  });
});
