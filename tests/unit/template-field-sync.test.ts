import { describe, it, expect, vi } from 'vitest';
import { buildTemplateFieldRows, syncTemplateFieldRows } from '@/lib/template-field-sync';

/**
 * TemplateField rows are what the CSV importer validates incoming rows against
 * (src/app/api/cardholders/import/route.ts). That read guards with
 * `length > 0`, so a template with no rows imports with no validation — which
 * is what happened to every never-edited template, because the Prisma-extension
 * hook meant to cover creates could not run. These lock the row shape, which
 * must stay identical to what the PUT route produced, and the two-query sync.
 */

describe('buildTemplateFieldRows', () => {
  it('emits front rows before back rows, with sortOrder restarting per side', () => {
    const rows = buildTemplateFieldRows(
      5,
      JSON.stringify([{ field: 'name' }, { field: 'photo', type: 'image' }]),
      JSON.stringify([{ field: 'note' }])
    );

    expect(rows.map((r) => [r.field, r.side, r.sortOrder])).toEqual([
      ['name', 'front', 1],
      ['photo', 'front', 2],
      ['note', 'back', 1],
    ]);
    expect(rows.every((r) => r.templateId === 5)).toBe(true);
  });

  it('applies the documented defaults for an otherwise bare field', () => {
    const [row] = buildTemplateFieldRows(1, JSON.stringify([{ field: 'name' }]), '[]');

    expect(row).toEqual({
      templateId: 1,
      field: 'name',
      type: 'text',
      side: 'front',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      fontSize: null,
      fontWeight: 'normal',
      fontFamily: null,
      color: '#000000',
      align: 'left',
      verticalAlign: 'top',
      isRequired: false,
      prefix: null,
      suffix: null,
      lineHeight: 1.2,
      sortOrder: 1,
    });
  });

  it('renames duplicates instead of dropping them, since (templateId, field, side) is unique', () => {
    const rows = buildTemplateFieldRows(
      1,
      JSON.stringify([{ field: 'name' }, { field: 'name' }, { field: 'name' }]),
      '[]'
    );
    expect(rows.map((r) => r.field)).toEqual(['name', 'name_2', 'name_3']);
  });

  it('treats the same name on opposite sides as distinct', () => {
    const rows = buildTemplateFieldRows(1, JSON.stringify([{ field: 'logo' }]), JSON.stringify([{ field: 'logo' }]));
    expect(rows.map((r) => [r.field, r.side])).toEqual([
      ['logo', 'front'],
      ['logo', 'back'],
    ]);
  });

  it('falls back to id, then a positional name, when no field key is set', () => {
    const rows = buildTemplateFieldRows(1, JSON.stringify([{ id: 'from_id' }, {}]), '[]');
    expect(rows.map((r) => r.field)).toEqual(['from_id', 'field_front_2']);
  });

  it('reads isRequired from either key the editor may have written', () => {
    const rows = buildTemplateFieldRows(
      1,
      JSON.stringify([{ field: 'a', required: true }, { field: 'b', isRequired: true }, { field: 'c' }]),
      '[]'
    );
    expect(rows.map((r) => r.isRequired)).toEqual([true, true, false]);
  });

  it('yields no rows for empty, null or malformed field JSON rather than throwing', () => {
    expect(buildTemplateFieldRows(1, '[]', '[]')).toEqual([]);
    expect(buildTemplateFieldRows(1, null, undefined)).toEqual([]);
    expect(buildTemplateFieldRows(1, '{not json', 'also not json')).toEqual([]);
    expect(buildTemplateFieldRows(1, '{"field":"notAnArray"}', '[]')).toEqual([]);
  });
});

describe('syncTemplateFieldRows', () => {
  function fakeDb() {
    const calls: string[] = [];
    return {
      calls,
      templateField: {
        deleteMany: vi.fn(async (_args: any) => { calls.push('deleteMany'); return { count: 0 }; }),
        createMany: vi.fn(async (_args: any) => { calls.push('createMany'); return { count: 0 }; }),
      },
    };
  }

  it('replaces the rows in exactly two queries, however many fields there are', async () => {
    const db = fakeDb();
    const many = JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ field: `f${i}` })));

    await syncTemplateFieldRows(db, 9, many, '[]');

    expect(db.calls).toEqual(['deleteMany', 'createMany']);
    expect(db.templateField.deleteMany).toHaveBeenCalledWith({ where: { templateId: 9 } });
    const arg = db.templateField.createMany.mock.calls[0][0] as any;
    expect(arg.data).toHaveLength(40);
    expect(arg.skipDuplicates).toBe(true);
  });

  it('clears rows but skips the insert when a template has no fields left', async () => {
    const db = fakeDb();
    await syncTemplateFieldRows(db, 9, '[]', '[]');
    expect(db.calls).toEqual(['deleteMany']);
  });

  it('stays non-fatal when the write fails, as the PUT route did', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db: any = {
      templateField: {
        deleteMany: async () => { throw new Error('db down'); },
        createMany: async () => ({ count: 0 }),
      },
    };

    await expect(syncTemplateFieldRows(db, 9, '[]', '[]')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
