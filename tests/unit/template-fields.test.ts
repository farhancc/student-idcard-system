import { describe, it, expect } from 'vitest';
import {
  parseTemplateFields,
  pickPrimaryPhotoKey,
  isImageField,
} from '@/lib/pdf/field-resolver';

/**
 * These lock the invariant behind the batch-import blank-photo bug: whoever
 * builds `customFields` for the renderer must derive field keys from the
 * template's own front/back JSON, in front-then-back order, and must pick the
 * primary photo field by the same rule the renderer does.
 */
describe('parseTemplateFields', () => {
  it('reads front fields before back fields', () => {
    const keys = parseTemplateFields({
      frontFields: JSON.stringify([{ field: 'photo', type: 'image' }, { field: 'name', type: 'text' }]),
      backFields: JSON.stringify([{ field: 'logo', type: 'image' }]),
    }).map(f => f.field);

    expect(keys).toEqual(['photo', 'name', 'logo']);
  });

  it('accepts already-parsed arrays as well as JSON strings', () => {
    const keys = parseTemplateFields({
      frontFields: [{ field: 'name', type: 'text' }],
      backFields: '[{"field":"note","type":"text"}]',
    }).map(f => f.field);

    expect(keys).toEqual(['name', 'note']);
  });

  it('drops duplicate keys, keeping the first occurrence', () => {
    const defs = parseTemplateFields({
      frontFields: JSON.stringify([{ field: 'photo', type: 'image' }, { field: 'photo', type: 'image' }]),
      backFields: '[]',
    });

    expect(defs).toHaveLength(1);
    expect(defs[0].field).toBe('photo');
  });

  it('skips entries with no field key rather than inventing one', () => {
    const keys = parseTemplateFields({
      frontFields: JSON.stringify([{ id: 'abc', type: 'image' }, { field: 'name', type: 'text' }]),
      backFields: '[]',
    }).map(f => f.field);

    expect(keys).toEqual(['name']);
  });

  it('defaults a missing type to text and survives malformed input', () => {
    expect(parseTemplateFields({ frontFields: '{not json', backFields: null })).toEqual([]);
    expect(parseTemplateFields(null)).toEqual([]);
    expect(parseTemplateFields({ frontFields: '[{"field":"x"}]' })[0].type).toBe('text');
  });
});

describe('pickPrimaryPhotoKey', () => {
  const imagesOf = (t: { frontFields?: unknown; backFields?: unknown }) =>
    parseTemplateFields(t).filter(f => isImageField(f));

  it('prefers the cardholder photo over a back-side logo', () => {
    const template = {
      frontFields: JSON.stringify([{ field: 'student_photo', type: 'image' }]),
      backFields: JSON.stringify([{ field: 'logo', type: 'image' }]),
    };

    expect(pickPrimaryPhotoKey(imagesOf(template))).toBe('student_photo');
  });

  it('never picks a signature/logo/stamp when a real photo field exists', () => {
    const template = {
      frontFields: JSON.stringify([
        { field: 'signature', type: 'image' },
        { field: 'photo', type: 'image' },
      ]),
      backFields: '[]',
    };

    expect(pickPrimaryPhotoKey(imagesOf(template))).toBe('photo');
  });

  it('regression: a back-side image must not win just by sorting first', () => {
    // The TemplateField table is ordered side:'asc', so 'back' precedes 'front'.
    // Parsing the template JSON instead must still yield the front-side photo.
    const template = {
      frontFields: JSON.stringify([{ field: 'photo', type: 'image' }]),
      backFields: JSON.stringify([{ field: 'stamp', type: 'image' }]),
    };

    expect(pickPrimaryPhotoKey(imagesOf(template))).toBe('photo');
  });

  it('falls back to the first image field when none looks like a photo', () => {
    const template = {
      frontFields: JSON.stringify([{ field: 'qr_badge', type: 'image' }]),
      backFields: '[]',
    };

    expect(pickPrimaryPhotoKey(imagesOf(template))).toBe('qr_badge');
  });

  it('returns null when the template has no image fields', () => {
    expect(pickPrimaryPhotoKey([])).toBeNull();
  });
});
