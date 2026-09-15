import { describe, it, expect } from 'vitest';
import { remapAfterRowDelete } from '@/app/dashboard/clients/[id]/components/batchRows';

// Exercises the real helper the component uses, not a copy of it.
const deleteRow = (
  del: number,
  rows: Array<Record<string, string>>,
  selectedRows: number[],
  imageOverrides: Record<string, string>
) => ({
  rows: rows.filter((_, i) => i !== del),
  ...remapAfterRowDelete(del, selectedRows, imageOverrides),
});

/**
 * Rows in the Batch Import review grid are identified by position, and two other
 * structures hold those positions: `imageOverrides` (keyed `${rowIdx}:${field}`)
 * and `selectedRows`. Deleting a row therefore has to shift every index above it,
 * or uploaded photos silently re-attach to the wrong people.
 *
 * Covers remapAfterRowDelete(), the helper BatchCompilePanel.tsx calls.
 */
const ROWS = [
  { Name: 'Asha' },   // 0
  { Name: 'Bala' },   // 1
  { Name: 'Chitra' }, // 2
  { Name: 'Dev' },    // 3
];

describe('deleting a row from the batch', () => {
  it('keeps every uploaded photo attached to its own person', () => {
    const overrides = {
      '0:photo': 'asha.png',
      '2:photo': 'chitra.png',
      '3:photo': 'dev.png',
    };

    const out = deleteRow(1, ROWS, [0, 1, 2, 3], overrides);

    // Chitra moved 2 -> 1 and Dev 3 -> 2; their photos must move with them.
    expect(out.rows.map(r => r.Name)).toEqual(['Asha', 'Chitra', 'Dev']);
    expect(out.imageOverrides).toEqual({
      '0:photo': 'asha.png',
      '1:photo': 'chitra.png',
      '2:photo': 'dev.png',
    });
    out.rows.forEach((row, i) => {
      expect(out.imageOverrides[`${i}:photo`]).toBe(`${row.Name.toLowerCase()}.png`);
    });
  });

  it('drops the deleted row from the selection and shifts the rest', () => {
    const out = deleteRow(1, ROWS, [1, 2, 3], {});
    expect(out.selectedRows).toEqual([1, 2]); // was Chitra(2), Dev(3)
    expect(out.selectedRows).not.toContain(3);
  });

  it('discards the deleted row\'s own upload rather than reassigning it', () => {
    const out = deleteRow(1, ROWS, [], { '1:photo': 'bala.png', '2:photo': 'chitra.png' });
    expect(Object.values(out.imageOverrides)).not.toContain('bala.png');
    expect(out.imageOverrides['1:photo']).toBe('chitra.png');
  });

  it('leaves rows below the deleted index untouched', () => {
    const out = deleteRow(3, ROWS, [0, 3], { '0:photo': 'a.png', '3:photo': 'd.png' });
    expect(out.selectedRows).toEqual([0]);
    expect(out.imageOverrides).toEqual({ '0:photo': 'a.png' });
  });
});
