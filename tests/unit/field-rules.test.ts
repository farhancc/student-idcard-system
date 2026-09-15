import { describe, it, expect } from 'vitest';
import {
  isFieldVisible,
  computeFieldValue,
  resolveFieldRawValue,
  buildFieldDataContext,
} from '@/lib/pdf/field-resolver';
import { templateSchema } from '@/lib/schemas';

/**
 * Conditional visibility and computed values are the two rule features on a
 * template field. Both are evaluated at render time, on data that reaches the
 * renderer essentially unvalidated (`templateSchema` only size-caps the field
 * JSON), so the invariant these lock down is: a malformed rule degrades to "no
 * rule" and never throws. A rule must not be able to fail a production compile.
 */

const cardholder = {
  name: 'Asha Menon',
  designation: 'Student',
  photoUrl: 'https://example.com/asha.jpg',
  cardSerial: 'SN-001',
  uniqueKey: 'STU-42',
  customFields: JSON.stringify({
    bloodGroup: 'A+',
    category: 'Staff',
    department: '',
    age: '17',
    firstName: 'asha',
    lastName: 'menon',
  }),
};

const data = buildFieldDataContext(cardholder, null);

describe('isFieldVisible', () => {
  it('shows a field with no rule at all — the back-compat invariant', () => {
    expect(isFieldVisible({ field: 'bloodGroup', type: 'text' }, data, cardholder)).toBe(true);
  });

  it('shows a field whose rule has an empty or missing condition list', () => {
    expect(isFieldVisible({ visibleIf: { conditions: [] } }, data, cardholder)).toBe(true);
    expect(isFieldVisible({ visibleIf: { match: 'all' } as any }, data, cardholder)).toBe(true);
  });

  describe('operators', () => {
    const check = (op: string, field: string, value?: string) =>
      isFieldVisible({ visibleIf: { conditions: [{ field, op: op as any, value }] } }, data, cardholder);

    it('notEmpty / isEmpty reflect whether the value resolved', () => {
      expect(check('notEmpty', 'bloodGroup')).toBe(true);
      expect(check('isEmpty', 'bloodGroup')).toBe(false);
      // department is present but explicitly blank
      expect(check('notEmpty', 'department')).toBe(false);
      expect(check('isEmpty', 'department')).toBe(true);
      // a key that is not in the data at all
      expect(check('isEmpty', 'nosuchkey')).toBe(true);
    });

    it('eq / neq compare case-insensitively and trimmed', () => {
      expect(check('eq', 'category', 'Staff')).toBe(true);
      expect(check('eq', 'category', '  staff ')).toBe(true);
      expect(check('eq', 'category', 'Student')).toBe(false);
      expect(check('neq', 'category', 'Student')).toBe(true);
    });

    it('contains / startsWith match on substrings', () => {
      expect(check('contains', 'category', 'taf')).toBe(true);
      expect(check('contains', 'category', 'xyz')).toBe(false);
      expect(check('startsWith', 'category', 'St')).toBe(true);
      expect(check('startsWith', 'category', 'aff')).toBe(false);
    });

    it('gt / lt compare numerically', () => {
      expect(check('gt', 'age', '16')).toBe(true);
      expect(check('gt', 'age', '18')).toBe(false);
      expect(check('lt', 'age', '18')).toBe(true);
    });

    it('gt / lt are false when either side is not numeric, rather than NaN-driven', () => {
      expect(check('gt', 'category', '16')).toBe(false);
      expect(check('lt', 'category', '16')).toBe(false);
      expect(check('gt', 'age', 'abc')).toBe(false);
    });
  });

  it('combines conditions with all (default) and any', () => {
    const conditions = [
      { field: 'category', op: 'eq' as const, value: 'Staff' },
      { field: 'bloodGroup', op: 'eq' as const, value: 'O-' },
    ];
    expect(isFieldVisible({ visibleIf: { match: 'all', conditions } }, data, cardholder)).toBe(false);
    expect(isFieldVisible({ visibleIf: { match: 'any', conditions } }, data, cardholder)).toBe(true);
    // match defaults to all
    expect(isFieldVisible({ visibleIf: { conditions } }, data, cardholder)).toBe(false);
  });

  it('sees the same value the renderer would print, including alias resolution', () => {
    // `uniqueKey` resolves through getResolvedFieldValue's id chain, not a raw
    // key lookup — a rule must agree with what actually renders.
    const rendered = resolveFieldRawValue({ field: 'uniqueKey', type: 'id' }, data, cardholder);
    expect(String(rendered)).toBe('STU-42');
    expect(
      isFieldVisible(
        { visibleIf: { conditions: [{ field: 'uniqueKey', op: 'eq', value: 'STU-42' }] } },
        data,
        cardholder
      )
    ).toBe(true);
  });

  describe('malformed rules degrade to visible and never throw', () => {
    const cases: Array<[string, unknown]> = [
      ['unknown operator', { conditions: [{ field: 'category', op: 'sorcery', value: 'x' }] }],
      ['conditions not an array', { conditions: 'nope' }],
      ['condition not an object', { conditions: [null] }],
      ['condition missing a field key', { conditions: [{ op: 'eq', value: 'x' }] }],
      ['rule is an array', []],
      ['rule is a string', 'always'],
      ['rule is a number', 7],
    ];

    for (const [label, visibleIf] of cases) {
      it(label, () => {
        expect(() => isFieldVisible({ visibleIf } as any, data, cardholder)).not.toThrow();
        expect(isFieldVisible({ visibleIf } as any, data, cardholder)).toBe(true);
      });
    }

    it('ignores conditions beyond the cap instead of evaluating unbounded input', () => {
      const conditions = Array.from({ length: 500 }, () => ({
        field: 'category',
        op: 'eq' as const,
        value: 'Staff',
      }));
      expect(isFieldVisible({ visibleIf: { conditions } }, data, cardholder)).toBe(true);
    });
  });

  it('tolerates a null cardholder', () => {
    expect(isFieldVisible({ visibleIf: { conditions: [{ field: 'x', op: 'isEmpty' }] } }, {}, null)).toBe(true);
  });
});

describe('computeFieldValue', () => {
  it('returns undefined when the field carries no compute rule', () => {
    expect(computeFieldValue({ field: 'name' }, data, cardholder)).toBeUndefined();
    expect(computeFieldValue({ compute: { parts: [] } }, data, cardholder)).toBeUndefined();
  });

  it('concatenates field references and literals in order', () => {
    const value = computeFieldValue(
      {
        compute: {
          parts: [
            { kind: 'field', field: 'firstName' },
            { kind: 'literal', text: ' ' },
            { kind: 'field', field: 'lastName' },
          ],
        },
      },
      data,
      cardholder
    );
    expect(value).toBe('asha menon');
  });

  it('applies the same three transforms textTransform implements', () => {
    const part = (transform: string) =>
      computeFieldValue(
        { compute: { parts: [{ kind: 'field', field: 'firstName', transform: transform as any }] } },
        data,
        cardholder
      );
    expect(part('upper')).toBe('ASHA');
    expect(part('lower')).toBe('asha');
    expect(part('capitalize')).toBe('Asha');
  });

  it('renders an empty string for parts that resolve to nothing', () => {
    const value = computeFieldValue(
      {
        compute: {
          parts: [
            { kind: 'literal', text: 'Dept: ' },
            { kind: 'field', field: 'department' },
          ],
        },
      },
      data,
      cardholder
    );
    // The author pairs this with visibleIf to suppress the stray label; compute
    // itself does not silently drop the literal.
    expect(value).toBe('Dept: ');
  });

  it('skips malformed parts without throwing', () => {
    const value = computeFieldValue(
      {
        compute: {
          parts: [
            null,
            { kind: 'field' },
            { kind: 'literal' },
            { kind: 'wat', field: 'firstName' },
            { kind: 'field', field: 'firstName' },
          ],
        },
      } as any,
      data,
      cardholder
    );
    expect(value).toBe('asha');
  });
});

describe('resolveFieldRawValue with a compute rule', () => {
  it('lets the computed value replace the normal data binding', () => {
    const value = resolveFieldRawValue(
      {
        field: 'fullName',
        type: 'text',
        compute: {
          parts: [
            { kind: 'field', field: 'firstName', transform: 'capitalize' },
            { kind: 'literal', text: ' ' },
            { kind: 'field', field: 'lastName', transform: 'capitalize' },
          ],
        },
      } as any,
      data,
      cardholder
    );
    expect(value).toBe('Asha Menon');
  });

  it('still applies the max-character cap to a computed value', () => {
    const value = resolveFieldRawValue(
      {
        field: 'fullName',
        type: 'text',
        max: 4,
        compute: { parts: [{ kind: 'field', field: 'firstName' }, { kind: 'field', field: 'lastName' }] },
      } as any,
      data,
      cardholder
    );
    expect(value).toBe('asha');
  });

  it('still applies date formatting to a computed value', () => {
    const value = resolveFieldRawValue(
      {
        field: 'issueDate',
        type: 'date',
        dateFormat: 'DD/MM/YYYY',
        compute: { parts: [{ kind: 'literal', text: '2026-03-09' }] },
      } as any,
      data,
      cardholder
    );
    expect(value).toBe('09/03/2026');
  });

  it('does not fall back to staticValue when the computation is empty', () => {
    const value = resolveFieldRawValue(
      {
        field: 'note',
        type: 'text',
        staticValue: 'Fallback text',
        compute: { parts: [{ kind: 'field', field: 'department' }] },
      } as any,
      data,
      cardholder
    );
    expect(value).toBe('');
  });

  it('leaves a field with no compute rule behaving exactly as before', () => {
    expect(resolveFieldRawValue({ field: 'bloodGroup', type: 'text' }, data, cardholder)).toBe('A+');
  });
});

describe('buildFieldDataContext', () => {
  it('lets custom data win over core keys, matching the production PDF path', () => {
    const ctx = buildFieldDataContext(
      { name: 'Core Name', customFields: JSON.stringify({ name: 'Sheet Name' }) },
      null
    );
    expect(ctx.name).toBe('Sheet Name');
  });

  it('exposes id and uniqueKey, which the preview path used to omit entirely', () => {
    expect(data.id).toBe('STU-42');
    expect(data.uniqueKey).toBe('STU-42');
  });

  it('re-applies a resolved photo so an empty photo column cannot blank it', () => {
    const ctx = buildFieldDataContext(
      { photoUrl: 'https://example.com/p.jpg', customFields: JSON.stringify({ photo: '' }) },
      null
    );
    expect(ctx.photo).toBe('https://example.com/p.jpg');
  });

  it('survives customFields that is not JSON, rather than throwing mid-render', () => {
    expect(() => buildFieldDataContext({ customFields: 'not json at all' }, null)).not.toThrow();
    expect(() => buildFieldDataContext({ customFields: '{broken' }, null)).not.toThrow();
    expect(buildFieldDataContext({ customFields: 'not json at all' }, null).name).toBe('');
  });

  it('formats validTill and ignores an unparseable date', () => {
    expect(buildFieldDataContext(cardholder, '2026-03-09').validTill).toBe('Mar 2026');
    expect(buildFieldDataContext(cardholder, 'rubbish').validTill).toBe('');
  });

  it('tolerates a null cardholder', () => {
    expect(() => buildFieldDataContext(null, null)).not.toThrow();
  });
});

describe('templateSchema rule validation at the write boundary', () => {
  const template = (frontFields: unknown) => ({
    name: 'Student ID',
    frontImageUrl: 'https://example.com/front.png',
    frontFields: typeof frontFields === 'string' ? frontFields : JSON.stringify(frontFields),
  });

  const firstError = (frontFields: unknown) => {
    const result = templateSchema.safeParse(template(frontFields));
    return result.success ? null : result.error.issues[0].message;
  };

  it('accepts a template with well-formed rules', () => {
    const result = templateSchema.safeParse(
      template([
        {
          field: 'bloodGroup',
          visibleIf: { match: 'all', conditions: [{ field: 'bloodGroup', op: 'notEmpty' }] },
        },
        {
          field: 'fullName',
          compute: {
            parts: [
              { kind: 'field', field: 'firstName', transform: 'capitalize' },
              { kind: 'literal', text: ' ' },
            ],
          },
        },
      ])
    );
    expect(result.success).toBe(true);
  });

  it('accepts a template whose fields carry no rules at all', () => {
    expect(templateSchema.safeParse(template([{ field: 'name', type: 'text', x: 1, y: 2 }])).success).toBe(true);
  });

  it('rejects an operator the evaluator does not implement', () => {
    expect(firstError([{ field: 'a', visibleIf: { conditions: [{ field: 'b', op: 'regex' }] } }]))
      .toMatch(/field "a"/);
  });

  it('rejects a condition with no field name', () => {
    expect(firstError([{ field: 'a', visibleIf: { conditions: [{ op: 'eq', value: 'x' }] } }]))
      .toMatch(/must name a field/);
  });

  it('rejects more conditions than the cap allows', () => {
    const conditions = Array.from({ length: 21 }, () => ({ field: 'b', op: 'notEmpty' }));
    expect(firstError([{ field: 'a', visibleIf: { conditions } }])).toMatch(/at most 20 conditions/);
  });

  it('rejects a computed value that references another computed field', () => {
    const error = firstError([
      { field: 'fullName', compute: { parts: [{ kind: 'field', field: 'firstName' }] } },
      { field: 'firstName', compute: { parts: [{ kind: 'literal', text: 'x' }] } },
    ]);
    expect(error).toMatch(/cannot reference "firstName", which is itself computed/);
  });

  it('allows a computed value to reference an ordinary field', () => {
    const result = templateSchema.safeParse(
      template([
        { field: 'fullName', compute: { parts: [{ kind: 'field', field: 'firstName' }] } },
        { field: 'firstName', type: 'text' },
      ])
    );
    expect(result.success).toBe(true);
  });

  it('leaves unparseable field JSON alone, as it always has', () => {
    expect(templateSchema.safeParse(template('{not json')).success).toBe(true);
  });

  it('does not constrain the long tail of renderer-only field properties', () => {
    const result = templateSchema.safeParse(
      template([{ field: 'a', letterSpacing: 2, opacity: 0.5, somethingNew: true }])
    );
    expect(result.success).toBe(true);
  });
});
