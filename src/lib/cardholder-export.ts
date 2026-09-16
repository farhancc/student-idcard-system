import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';
import { fetchPublicAsset, resolveWithinDir } from '@/lib/safe-fetch';
import { isImageField, resolveFieldRawValue, buildFieldDataContext, formatFieldLabel } from '@/lib/pdf/field-resolver';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export function photoExtension(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  return ext && IMAGE_EXTENSIONS.includes(ext) ? ext : 'jpg';
}

export function photoEntryName(id: number, name: string, url: string): string {
  return `photos/${id}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.${photoExtension(url)}`;
}

/**
 * Read one cardholder photo.
 *
 * Local `/uploads/...` paths are read from disk rather than fetched over HTTP:
 * `fetchPublicAsset` blocks private addresses, so a loopback round trip to our
 * own dev server would be refused — and it would be a pointless hop anyway.
 */
export async function readPhoto(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('/')) {
      const key = url.replace(/^\/(uploads\/)?/, '');
      const baseDir = path.join(process.cwd(), 'public', 'uploads');
      const resolved = resolveWithinDir(baseDir, key);
      if (!resolved) return null;
      return await fs.readFile(resolved);
    }
    const asset = await fetchPublicAsset(url, {
      allowedContentTypePrefixes: ['image/'],
    });
    return asset.body;
  } catch {
    return null;
  }
}

export interface ExportCardholder {
  id: number;
  name: string;
  designation: string | null;
  cardSerial: string | null;
  photoUrl: string | null;
  customFields: string | null;
  createdAt: Date;
}

/**
 * Excel sheet for a batch of cardholders: standard fields plus a "Field: X"
 * column per unique custom-field key across the whole batch (custom fields
 * vary per record, so no single row has the full set).
 *
 * `photoEntry` is only meaningful when photos were actually archived
 * alongside this workbook (see src/app/api/cardholders/export/route.ts) — set
 * `photosArchived: false` for a standalone Excel export, which drops the
 * archive-status column entirely rather than reporting every photo as
 * "MISSING" when none were ever attempted.
 */
export async function buildCardholderWorkbook(
  cardholders: ExportCardholder[],
  photoEntry: Map<number, string> = new Map(),
  photosArchived = true,
): Promise<Buffer> {
  const rows = cardholders.map((ch) => {
    const row: Record<string, string | number> = {
      ID: ch.id,
      Name: ch.name,
      Designation: ch.designation ?? '',
      'Card Serial': ch.cardSerial ?? '',
      'Date Added': ch.createdAt.toISOString(),
    };
    if (photosArchived) {
      row['Photo File'] = ch.photoUrl
        ? photoEntry.get(ch.id) ?? 'MISSING — not archived'
        : 'None';
    }
    row['Original Photo URL'] = ch.photoUrl ?? '';
    if (ch.customFields) {
      try {
        const parsed = JSON.parse(ch.customFields);
        if (parsed && typeof parsed === 'object') {
          for (const [key, val] of Object.entries(parsed)) {
            row[`Field: ${key}`] = val == null ? '' : String(val);
          }
        }
      } catch {
        /* a malformed custom-fields blob must not sink the whole export */
      }
    }
    return row;
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cardholders');

  const columns = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) columns.add(key);
  sheet.columns = Array.from(columns).map((key) => ({ header: key, key, width: 20 }));
  rows.forEach((row) => sheet.addRow(row));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ── Template-column export (Cardholders tab "Export Excel" / "Download ZIP") ──
//
// Unlike buildCardholderWorkbook above (a generic backup roster, used by the
// retention purge/export flow and left untouched), this mirrors exactly what
// the on-screen table shows for a given template: one column per field the
// template actually defines — no ID/Card-Serial/generic-custom-field-union
// columns that aren't part of the template. Each cardholder image field
// resolves through the same buildFieldDataContext/resolveFieldRawValue path
// the card renderer itself uses, so an "Excel says the same fields the card
// renders" guarantee holds even for computed/static fields.

export interface ExportColumn {
  key: string;
  label: string;
  isImage: boolean;
}

/** One column per field the template defines, deduped, skipping qr/barcode
 *  (nothing to show for those). No template (the "Unassigned" group) falls
 *  back to the same basic columns the unassigned table already shows. */
export function getTemplateExportColumns(
  template: { frontFields?: unknown; backFields?: unknown } | null
): ExportColumn[] {
  if (!template) {
    return [
      { key: 'name', label: 'Name', isImage: false },
      { key: 'designation', label: 'Designation', isImage: false },
      { key: 'photo', label: 'Photo', isImage: true },
    ];
  }

  const parse = (raw: unknown): Array<Record<string, any>> => {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const seen = new Set<string>();
  const columns: ExportColumn[] = [];
  for (const f of [...parse(template.frontFields), ...parse(template.backFields)]) {
    const key = typeof f.field === 'string' ? f.field : '';
    if (!key || seen.has(key) || f.type === 'qr' || f.type === 'barcode') continue;
    seen.add(key);
    const label = String(f.label || f.name || '').trim() || formatFieldLabel(key);
    columns.push({ key, label, isImage: isImageField(f) });
  }
  return columns;
}

/** Archive key for one cardholder's one image field — a cardholder can have
 *  more than one (e.g. Photo and Signature), so this can't be keyed on
 *  cardholder id alone the way the single-photo retention export is. */
export function templateFieldEntryName(cardholderId: number, name: string, fieldKey: string, url: string): string {
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const safeField = fieldKey.replace(/[^a-zA-Z0-9]/g, '_');
  return `photos/${cardholderId}_${safeName}_${safeField}.${photoExtension(url)}`;
}

/**
 * Resolve every column's value for one cardholder, exactly as the card
 * renderer would (computed/static fields, date formatting, etc. all apply).
 */
export function resolveExportRow(
  cardholder: ExportCardholder,
  columns: ExportColumn[]
): Map<string, unknown> {
  const data = buildFieldDataContext(cardholder);
  const values = new Map<string, unknown>();
  for (const col of columns) {
    values.set(col.key, resolveFieldRawValue({ field: col.key, type: col.isImage ? 'image' : 'text' }, data, cardholder));
  }
  return values;
}

/**
 * Build the workbook for the template-column export.
 *
 * `photoEntry` maps `${cardholderId}:${fieldKey}` -> archived filename, only
 * populated when `format === 'zip'` — an image column then shows the
 * filename inside the archive instead of the source URL, so the sheet and
 * the photos/ folder line up. For a standalone Excel export (no zip), image
 * columns fall back to the raw URL — there is no archived file to name.
 */
export async function buildTemplateColumnWorkbook(
  cardholders: ExportCardholder[],
  columns: ExportColumn[],
  photoEntry: Map<string, string> = new Map(),
  photosArchived = false,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cardholders');
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: 22 }));

  for (const ch of cardholders) {
    const resolved = resolveExportRow(ch, columns);
    const row: Record<string, string> = {};
    for (const col of columns) {
      const val = resolved.get(col.key);
      if (col.isImage) {
        if (photosArchived) {
          row[col.key] = val ? (photoEntry.get(`${ch.id}:${col.key}`) ?? 'MISSING — not archived') : '';
        } else {
          row[col.key] = val ? String(val) : '';
        }
      } else {
        row[col.key] = val != null ? String(val) : '';
      }
    }
    sheet.addRow(row);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
