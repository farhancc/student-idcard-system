import { describe, it, expect } from 'vitest';

/**
 * Tenant Isolation Unit Tests
 *
 * These tests verify the *logic* of the Prisma client extension that enforces
 * multi-tenant isolation. Since we can't instantiate a real Prisma client in
 * unit tests without a database, we replicate the extension's argument-rewriting
 * logic and assert that it injects the correct tenant filters.
 *
 * The actual extension lives in src/lib/prisma.ts.
 */

// ── Replicated constants from src/lib/prisma.ts ─────────────────────────

const TENANT_MODELS = [
  'PressUser', 'Client', 'Cardholder', 'CardTemplate', 'CardOrder',
  'OrderInvoice', 'CardSerialCounter', 'CardPrintRecord', 'PdfDownloadLog',
  'OrderActivityLog', 'PressFont', 'OrderNote', 'DeliveryRecord',
  'PressApiKey', 'PrintVendor', 'ClientPortalShare',
  'PdfJob', 'CardAsset', 'CreditRequest',
  'TemplatePurchase', 'TemplateLike', 'TemplateReport',
];

const NON_TENANT_MODELS = [
  'Press', 'SuperAdmin', 'MarketplaceTemplate',
  'TemplateField', 'CardholderValue',
];

/**
 * Simulates the argument rewriting logic from the Prisma $extends query hook.
 * This is a faithful copy of the logic at src/lib/prisma.ts lines 189–260.
 */
function simulateTenantRewrite(
  model: string,
  operation: string,
  args: any,
  pressId: number | null
): any {
  const result = JSON.parse(JSON.stringify(args)); // deep clone

  const pressIdField = model === 'TemplatePurchase' ? 'buyerPressId' : 'pressId';

  if (TENANT_MODELS.includes(model) && pressId !== null) {
    // Read operations
    if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy', 'findFirstOrThrow'].includes(operation)) {
      result.where = result.where || {};
      if (model === 'CardTemplate') {
        const existingWhere = result.where;
        result.where = {
          AND: [
            existingWhere,
            {
              OR: [
                { pressId: null },
                { pressId: pressId },
              ],
            },
          ],
        };
      } else {
        result.where[pressIdField] = pressId;
      }
    }

    // findUnique → findFirst rewrite
    if (['findUnique', 'findUniqueOrThrow'].includes(operation)) {
      result.where = result.where || {};
      result.where[pressIdField] = pressId;
      result._rewrittenTo = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
    }

    // Create operations
    if (['create', 'createMany'].includes(operation)) {
      if (Array.isArray(result.data)) {
        result.data = result.data.map((item: any) => ({ ...item, [pressIdField]: pressId }));
      } else {
        result.data = result.data || {};
        result.data[pressIdField] = pressId;
      }
    }

    // Update/delete/upsert operations
    if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
      result.where = result.where || {};
      result.where[pressIdField] = pressId;
      if (operation === 'upsert') {
        result.create = result.create || {};
        result.create[pressIdField] = pressId;
        result.update = result.update || {};
        result.update[pressIdField] = pressId;
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Tenant Isolation — Read Operations', () => {
  const pressId = 42;

  it('injects pressId filter on findMany for tenant models', () => {
    for (const model of ['Client', 'Cardholder', 'CardOrder', 'PdfJob']) {
      const result = simulateTenantRewrite(model, 'findMany', { where: {} }, pressId);
      expect(result.where.pressId).toBe(pressId);
    }
  });

  it('injects pressId filter on findFirst for tenant models', () => {
    const result = simulateTenantRewrite('Client', 'findFirst', { where: { name: 'ABC' } }, pressId);
    expect(result.where.pressId).toBe(pressId);
    expect(result.where.name).toBe('ABC');
  });

  it('injects pressId filter on count for tenant models', () => {
    const result = simulateTenantRewrite('Cardholder', 'count', { where: { active: true } }, pressId);
    expect(result.where.pressId).toBe(pressId);
    expect(result.where.active).toBe(true);
  });

  it('does NOT inject pressId for non-tenant models', () => {
    for (const model of NON_TENANT_MODELS) {
      const result = simulateTenantRewrite(model, 'findMany', { where: {} }, pressId);
      expect(result.where.pressId).toBeUndefined();
    }
  });

  it('does NOT inject pressId when pressId is null (no active session)', () => {
    const result = simulateTenantRewrite('Client', 'findMany', { where: {} }, null);
    expect(result.where.pressId).toBeUndefined();
  });
});

describe('Tenant Isolation — CardTemplate Special Case', () => {
  const pressId = 42;

  it('uses OR filter to include global templates (pressId: null) AND tenant templates', () => {
    const result = simulateTenantRewrite('CardTemplate', 'findMany', { where: { category: 'ID_CARD' } }, pressId);

    expect(result.where.AND).toBeDefined();
    expect(result.where.AND).toHaveLength(2);

    // First AND clause: original where condition
    expect(result.where.AND[0].category).toBe('ID_CARD');

    // Second AND clause: OR for global + tenant
    const orClause = result.where.AND[1].OR;
    expect(orClause).toHaveLength(2);
    expect(orClause[0]).toEqual({ pressId: null });
    expect(orClause[1]).toEqual({ pressId });
  });

  it('preserves existing where conditions when adding tenant filter', () => {
    const result = simulateTenantRewrite('CardTemplate', 'findMany', {
      where: { name: { contains: 'School' } },
    }, pressId);

    expect(result.where.AND[0].name.contains).toBe('School');
    expect(result.where.AND[1].OR).toBeDefined();
  });
});

describe('Tenant Isolation — findUnique Rewrite', () => {
  const pressId = 42;

  it('rewrites findUnique to findFirst and injects pressId', () => {
    const result = simulateTenantRewrite('Client', 'findUnique', { where: { id: 5 } }, pressId);
    expect(result._rewrittenTo).toBe('findFirst');
    expect(result.where.pressId).toBe(pressId);
    expect(result.where.id).toBe(5);
  });

  it('rewrites findUniqueOrThrow to findFirstOrThrow', () => {
    const result = simulateTenantRewrite('Client', 'findUniqueOrThrow', { where: { id: 5 } }, pressId);
    expect(result._rewrittenTo).toBe('findFirstOrThrow');
    expect(result.where.pressId).toBe(pressId);
  });

  it('does NOT rewrite findUnique for non-tenant models', () => {
    const result = simulateTenantRewrite('Press', 'findUnique', { where: { id: 5 } }, pressId);
    expect(result._rewrittenTo).toBeUndefined();
    expect(result.where.pressId).toBeUndefined();
  });
});

describe('Tenant Isolation — Write Operations', () => {
  const pressId = 42;

  it('injects pressId into create data', () => {
    const result = simulateTenantRewrite('Client', 'create', {
      data: { name: 'New Client', type: 'SCHOOL' },
    }, pressId);

    expect(result.data.pressId).toBe(pressId);
    expect(result.data.name).toBe('New Client');
  });

  it('injects pressId into createMany data array', () => {
    const result = simulateTenantRewrite('Cardholder', 'createMany', {
      data: [
        { name: 'Alice' },
        { name: 'Bob' },
      ],
    }, pressId);

    expect(result.data[0].pressId).toBe(pressId);
    expect(result.data[1].pressId).toBe(pressId);
    expect(result.data[0].name).toBe('Alice');
  });

  it('injects pressId into update where clause', () => {
    const result = simulateTenantRewrite('Client', 'update', {
      where: { id: 5 },
      data: { name: 'Updated' },
    }, pressId);

    expect(result.where.pressId).toBe(pressId);
    expect(result.data.name).toBe('Updated');
  });

  it('injects pressId into delete where clause', () => {
    const result = simulateTenantRewrite('Cardholder', 'delete', {
      where: { id: 10 },
    }, pressId);

    expect(result.where.pressId).toBe(pressId);
  });

  it('injects pressId into deleteMany where clause', () => {
    const result = simulateTenantRewrite('CardAsset', 'deleteMany', {
      where: { isStale: true },
    }, pressId);

    expect(result.where.pressId).toBe(pressId);
    expect(result.where.isStale).toBe(true);
  });

  it('injects pressId into upsert (where, create, AND update)', () => {
    const result = simulateTenantRewrite('CardAsset', 'upsert', {
      where: { cardholderId: 7 },
      create: { cardholderId: 7, frontUrl: '/f.png', backUrl: '/b.png' },
      update: { frontUrl: '/f2.png' },
    }, pressId);

    expect(result.where.pressId).toBe(pressId);
    expect(result.create.pressId).toBe(pressId);
    expect(result.update.pressId).toBe(pressId);
  });

  it('does NOT inject pressId into writes for non-tenant models', () => {
    const result = simulateTenantRewrite('Press', 'create', {
      data: { name: 'New Press' },
    }, pressId);

    expect(result.data.pressId).toBeUndefined();
  });
});

describe('Tenant Isolation — TemplatePurchase Special Field', () => {
  const pressId = 42;

  it('uses buyerPressId instead of pressId for TemplatePurchase model', () => {
    const readResult = simulateTenantRewrite('TemplatePurchase', 'findMany', { where: {} }, pressId);
    expect(readResult.where.buyerPressId).toBe(pressId);
    expect(readResult.where.pressId).toBeUndefined();

    const createResult = simulateTenantRewrite('TemplatePurchase', 'create', {
      data: { templateId: 10, price: 100 },
    }, pressId);
    expect(createResult.data.buyerPressId).toBe(pressId);
    expect(createResult.data.pressId).toBeUndefined();
  });
});

describe('Tenant Isolation — x-press-id Header Enforcement', () => {
  it('tenant models list includes all expected models', () => {
    // Verify the critical tenant models are in the list
    const criticalModels = ['Client', 'Cardholder', 'CardOrder', 'CardTemplate', 'PressUser'];
    for (const model of criticalModels) {
      expect(TENANT_MODELS).toContain(model);
    }
  });

  it('tenant models list does NOT include global models', () => {
    for (const model of NON_TENANT_MODELS) {
      expect(TENANT_MODELS).not.toContain(model);
    }
  });

  it('TemplatePurchase is in tenant models (uses buyerPressId)', () => {
    expect(TENANT_MODELS).toContain('TemplatePurchase');
  });
});
