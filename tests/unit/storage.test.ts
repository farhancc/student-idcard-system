import { describe, it, expect } from 'vitest';
import { parseR2KeyFromUrl, isR2Configured } from '@/lib/storage';

describe('Cloudflare R2 Storage Module', () => {
  describe('parseR2KeyFromUrl', () => {
    it('parses local /uploads/ URLs correctly', () => {
      const key = parseR2KeyFromUrl('/uploads/press_1/photos/student.png');
      expect(key).toBe('press_1/photos/student.png');
    });

    it('parses Cloudflare R2 / S3 public URLs correctly', () => {
      const key = parseR2KeyFromUrl('https://pub-r2.idexo.app/cardholders/photos/1700000000-abc123.jpg');
      expect(key).toBe('cardholders/photos/1700000000-abc123.jpg');
    });

    it('parses legacy Cloudinary URLs correctly as fallback', () => {
      const key = parseR2KeyFromUrl('https://res.cloudinary.com/demo/image/upload/v1612345/press_1/photos/student.jpg');
      expect(key).toBe('press_1/photos/student.jpg');
    });

    it('handles relative path or plain key strings', () => {
      const key = parseR2KeyFromUrl('press_2/templates/layout.pdf');
      expect(key).toBe('press_2/templates/layout.pdf');
    });

    it('returns null for empty input', () => {
      expect(parseR2KeyFromUrl('')).toBeNull();
    });
  });

  describe('isR2Configured', () => {
    it('evaluates boolean based on R2 env variables', () => {
      expect(typeof isR2Configured).toBe('boolean');
    });
  });
});
