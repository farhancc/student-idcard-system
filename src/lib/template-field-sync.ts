/**
 * Keeps the normalized TemplateField table in step with a template's
 * front/back field JSON.
 *
 * TemplateField is read by the CSV importer to validate incoming rows against
 * the template's required fields (see src/app/api/cardholders/import/route.ts).
 * That read guards with `length > 0`, so a template with no field rows is
 * imported with no validation at all — which is what happened to every template
 * that was created and never edited, because the only writer was the PUT route.
 * A dead Prisma-extension hook was supposed to cover creates and never ran.
 *
 * This is the row builder that PUT route already used, lifted out so the create
 * paths produce byte-identical rows rather than a second interpretation of the
 * same JSON.
 */

/** One row of the normalized TemplateField table. */
export interface TemplateFieldRow {
  templateId: number;
  field: string;
  type: string;
  side: 'front' | 'back';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number | null;
  fontWeight: string;
  fontFamily: string | null;
  color: string;
  align: string;
  verticalAlign: string;
  isRequired: boolean;
  prefix: string | null;
  suffix: string | null;
  lineHeight: number;
  sortOrder: number;
}

/**
 * A field as it appears in a template's stored JSON. Operator-authored and
 * schemaless by history, so every key is read defensively.
 */
type StoredField = Record<string, any>;

/**
 * Turns a template's field JSON into TemplateField rows.
 *
 * Duplicate field names are renamed with a counter suffix rather than dropped:
 * (templateId, field, side) is unique, and an operator who names two fields the
 * same should still get both rows. sortOrder restarts per side.
 */
export function buildTemplateFieldRows(
  templateId: number,
  frontFieldsJson: string | null | undefined,
  backFieldsJson: string | null | undefined
): TemplateFieldRow[] {
  let parsedFront: StoredField[] = [];
  let parsedBack: StoredField[] = [];
  try { parsedFront = JSON.parse(frontFieldsJson || '[]'); } catch {}
  try { parsedBack = JSON.parse(backFieldsJson || '[]'); } catch {}
  if (!Array.isArray(parsedFront)) parsedFront = [];
  if (!Array.isArray(parsedBack)) parsedBack = [];

  const seenFields = new Set<string>();
  const fieldRows: TemplateFieldRow[] = [];

  const processFields = (fields: StoredField[], side: 'front' | 'back') => {
    fields.forEach((f: StoredField, idx: number) => {
      const rawKey = f.field || f.id || `field_${side}_${idx + 1}`;
      let uniqueKey = String(rawKey).trim();
      let counter = 1;
      while (seenFields.has(`${side}:${uniqueKey.toLowerCase()}`)) {
        counter++;
        uniqueKey = `${rawKey}_${counter}`;
      }
      seenFields.add(`${side}:${uniqueKey.toLowerCase()}`);

      fieldRows.push({
        templateId,
        field: uniqueKey,
        type: f.type || 'text',
        side,
        x: Number(f.x || 0),
        y: Number(f.y || 0),
        width: Number(f.width || 0),
        height: Number(f.height || 0),
        fontSize: f.fontSize ? Number(f.fontSize) : null,
        fontWeight: f.fontWeight || 'normal',
        fontFamily: f.fontFamily || null,
        color: f.color || '#000000',
        align: f.align || 'left',
        verticalAlign: f.verticalAlign || 'top',
        isRequired: Boolean(f.required || f.isRequired),
        prefix: f.prefix || null,
        suffix: f.suffix || null,
        lineHeight: f.lineHeight ? Number(f.lineHeight) : 1.2,
        sortOrder: idx + 1,
      });
    });
  };

  processFields(parsedFront, 'front');
  processFields(parsedBack, 'back');

  return fieldRows;
}

/**
 * Replaces a template's TemplateField rows in two queries.
 *
 * Non-fatal by design, as it was in the PUT route: a template whose normalized
 * rows fail to write is still a usable template, and failing the whole save
 * would be worse than importing without field validation.
 *
 * `db` is a Prisma client or an interactive-transaction client; pass the tx when
 * the template write is itself in one, so the rows land with it.
 *
 * TemplateField carries no pressId, so it is not a tenant model and nothing
 * scopes these writes for you: `templateId` must already be known to belong to
 * the caller's press.
 */
export async function syncTemplateFieldRows(
  db: any,
  templateId: number,
  frontFieldsJson: string | null | undefined,
  backFieldsJson: string | null | undefined
): Promise<void> {
  try {
    await db.templateField.deleteMany({ where: { templateId } });
    const fieldRows = buildTemplateFieldRows(templateId, frontFieldsJson, backFieldsJson);
    if (fieldRows.length > 0) {
      await db.templateField.createMany({ data: fieldRows, skipDuplicates: true });
    }
  } catch (err) {
    console.warn(`[TemplateField] Non-fatal issue syncing fields for template ${templateId}:`, err);
  }
}
