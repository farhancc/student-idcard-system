import { describe, it, expect } from 'vitest';
import { renderCardSideToPdfBytesClient } from '@/lib/pdf/card-renderer-client';

/**
 * End-to-end cover for conditional visibility on the path that actually ships:
 * real field JSON in, real PDF bytes out, text read back with pdfjs.
 *
 * The unit tests around `isFieldVisible` prove the predicate; this proves the
 * production renderer consults it, which is the part a refactor could silently
 * drop. It runs headless — no background image, no remote fonts — so the
 * renderer takes its no-DOM measurement fallback.
 */

const extractText = async (bytes: Uint8Array): Promise<string[]> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return content.items
    .map((i: any) => (typeof i.str === 'string' ? i.str : ''))
    .filter(Boolean);
};

/** Text items with their baseline Y, for asserting that layout did not shift. */
const extractPositioned = async (bytes: Uint8Array): Promise<Array<{ str: string; y: number }>> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return content.items
    .filter((i: any) => typeof i.str === 'string' && i.str.trim())
    .map((i: any) => ({ str: i.str, y: Math.round(i.transform[5] * 100) / 100 }));
};

const fields = [
  { field: 'name', type: 'text', x: 40, y: 40, width: 500, height: 40, fontSize: 24 },
  {
    field: 'bloodGroup',
    type: 'text',
    x: 40,
    y: 100,
    width: 500,
    height: 40,
    fontSize: 24,
    prefix: 'Blood: ',
    visibleIf: { conditions: [{ field: 'bloodGroup', op: 'notEmpty' }] },
  },
  {
    field: 'fullName',
    type: 'text',
    x: 40,
    y: 160,
    width: 500,
    height: 40,
    fontSize: 24,
    compute: {
      parts: [
        { kind: 'field', field: 'firstName', transform: 'upper' },
        { kind: 'literal', text: '-' },
        { kind: 'field', field: 'lastName', transform: 'upper' },
      ],
    },
  },
];

const template = {
  cardWidth: 673,
  cardHeight: 1039,
  frontImageUrl: '',
  backImageUrl: null,
  frontFields: JSON.stringify(fields),
  backFields: '[]',
};

const renderText = async (customFields: Record<string, string>) => {
  const bytes = await renderCardSideToPdfBytesClient(
    template as any,
    { name: 'Asha Menon', customFields: JSON.stringify(customFields) } as any,
    'front',
    null,
    []
  );
  return (await extractText(bytes)).join('|');
};

describe('the production PDF path honours field rules', () => {
  it('prints a conditional field when its rule passes', async () => {
    const text = await renderText({ bloodGroup: 'A+', firstName: 'asha', lastName: 'menon' });
    expect(text).toContain('Blood: A+');
    expect(text).toContain('Asha Menon');
  }, 30000);

  it('omits the field entirely when its rule fails, leaving the rest intact', async () => {
    const text = await renderText({ bloodGroup: '', firstName: 'asha', lastName: 'menon' });
    expect(text).not.toContain('Blood');
    // The prefix must not survive on its own either — the whole field is gone.
    expect(text).not.toContain('Blood: ');
    expect(text).toContain('Asha Menon');
  }, 30000);

  it('prints a computed value composed from two other columns', async () => {
    const text = await renderText({ bloodGroup: 'A+', firstName: 'asha', lastName: 'menon' });
    expect(text).toContain('ASHA-MENON');
  }, 30000);
});

describe('hiding a field does not move the fields below it', () => {
  /**
   * The live computeYOffsets pushes lower fields down when a field's text
   * overflows its box. A hidden field contributes no height, so a long value in
   * a hidden field must not shift anything — otherwise the layout would silently
   * depend on data that is not even printed.
   */
  const overflowFields = [
    {
      field: 'notes',
      type: 'text',
      x: 40,
      y: 40,
      width: 200,
      height: 30,
      fontSize: 24,
      visibleIf: { conditions: [{ field: 'showNotes', op: 'eq', value: 'yes' }] },
    },
    { field: 'anchor', type: 'text', x: 40, y: 200, width: 500, height: 40, fontSize: 24 },
  ];

  const overflowTemplate = {
    cardWidth: 673,
    cardHeight: 1039,
    frontImageUrl: '',
    backImageUrl: null,
    frontFields: JSON.stringify(overflowFields),
    backFields: '[]',
  };

  const anchorY = async (showNotes: string) => {
    const bytes = await renderCardSideToPdfBytesClient(
      overflowTemplate as any,
      {
        name: 'Asha',
        customFields: JSON.stringify({
          showNotes,
          notes: 'a very long note that will certainly wrap over several lines and overflow its declared box height',
          anchor: 'ANCHOR',
        }),
      } as any,
      'front',
      null,
      []
    );
    const items = await extractPositioned(bytes);
    return items.find(i => i.str.includes('ANCHOR'))?.y;
  };

  it('keeps the lower field at its designed position when the overflowing field is hidden', async () => {
    const hidden = await anchorY('no');
    const shown = await anchorY('yes');

    expect(hidden).toBeDefined();
    expect(shown).toBeDefined();
    // Visible + overflowing pushes the anchor down the page (smaller PDF y).
    expect(shown!).toBeLessThan(hidden!);
  }, 30000);
});
