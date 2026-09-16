import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';
import { fetchPublicAsset, resolveWithinDir } from '@/lib/safe-fetch';

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
