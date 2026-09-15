import { describe, it, expect } from 'vitest';
import {
  normalizeGoogleDriveUrl,
  resolveFieldRawValue,
  isValidImageUrl,
} from '@/lib/pdf/field-resolver';

// A real (tiny) PNG data URI — note the comma between header and payload.
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('normalizeGoogleDriveUrl', () => {
  it('returns a data: URI untouched', () => {
    // Regression: the comma before the base64 payload was treated as a
    // multi-file list separator, truncating every ZIP photo to an empty header.
    expect(normalizeGoogleDriveUrl(PNG_DATA_URL)).toBe(PNG_DATA_URL);
  });

  it.each([
    'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    'data:image/webp;base64,UklGRh4AAABXRUJQ',
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"/>',
  ])('preserves the whole payload of %s', (url) => {
    expect(normalizeGoogleDriveUrl(url)).toBe(url);
  });

  it('keeps commas that are Cloudinary transformation parameters', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/w_200,h_200,c_fill/sample.jpg';
    expect(normalizeGoogleDriveUrl(url)).toBe(url);
  });

  it('still takes the first entry of a comma-separated list of URLs', () => {
    const first = 'https://drive.google.com/file/d/1AAAAAAAAAAAAAAAAAAAAAAA/view';
    expect(normalizeGoogleDriveUrl(`${first},https://example.com/second.jpg`))
      .toBe('https://lh3.googleusercontent.com/d/1AAAAAAAAAAAAAAAAAAAAAAA');
  });

  it('still rewrites Google Drive and R2 links', () => {
    expect(normalizeGoogleDriveUrl('https://drive.google.com/open?id=1BBBBBBBBBBBBBBBBBBBBBBB'))
      .toBe('https://lh3.googleusercontent.com/d/1BBBBBBBBBBBBBBBBBBBBBBB');
    expect(normalizeGoogleDriveUrl('https://acct.r2.cloudflarestorage.com/bucket/key.png?sig=x'))
      .toBe('/api/uploads/bucket/key.png');
  });

  it('returns null for empty input', () => {
    expect(normalizeGoogleDriveUrl('')).toBeNull();
    expect(normalizeGoogleDriveUrl(null)).toBeNull();
    expect(normalizeGoogleDriveUrl(undefined)).toBeNull();
  });
});

describe('resolveFieldRawValue — the path the PDF renderer takes', () => {
  // Mirrors what the batch importer hands the renderer: a ZIP photo inlined as a
  // data URI under the template's own image field key.
  const cardholder = {
    id: 1,
    name: 'Test Student',
    designation: null,
    photoUrl: PNG_DATA_URL,
    cardSerial: null,
    uniqueKey: 'SA-2024-001',
    customFields: JSON.stringify({ student_photo: PNG_DATA_URL }),
  };

  it('hands the renderer the complete data URI for an image field', () => {
    const resolved = resolveFieldRawValue(
      { field: 'student_photo', type: 'image' },
      { student_photo: PNG_DATA_URL },
      cardholder
    );

    expect(resolved).toBe(PNG_DATA_URL);
    expect(isValidImageUrl(resolved)).toBe(true);
    // The payload must survive — a truncated header decodes to no image at all,
    // which is what left the template's photo slot showing through the card.
    expect(String(resolved).split(',')[1]).toBeTruthy();
  });

  it('resolves the photo through customFields when it is not in data', () => {
    const resolved = resolveFieldRawValue(
      { field: 'student_photo', type: 'image' },
      {},
      cardholder
    );

    expect(resolved).toBe(PNG_DATA_URL);
  });
});
