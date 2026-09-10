import { describe, it, expect } from 'vitest';
import { clampLimit } from '@/lib/pagination';

describe('clampLimit helper', () => {
  it('returns default limit when raw input is undefined or null', () => {
    expect(clampLimit(undefined)).toBe(50);
    expect(clampLimit(null)).toBe(50);
  });

  it('returns default limit when raw input is NaN or invalid string', () => {
    expect(clampLimit('invalid')).toBe(50);
    expect(clampLimit(NaN)).toBe(50);
  });

  it('returns default limit when raw input is 0 or negative', () => {
    expect(clampLimit(0)).toBe(50);
    expect(clampLimit(-10)).toBe(50);
  });

  it('parses valid numeric string and numbers correctly', () => {
    expect(clampLimit('25')).toBe(25);
    expect(clampLimit(30)).toBe(30);
  });

  it('clamps values above maxLimit to maxLimit', () => {
    expect(clampLimit(500, 50, 100)).toBe(100);
    expect(clampLimit('1000', 50, 100)).toBe(100);
  });
});
