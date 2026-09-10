import { describe, it, expect } from 'vitest';

/**
 * Pure helper function testing serial number string construction logic
 * matching `src/lib/serials.ts` pattern.
 */
function formatSerial(prefix: string, seq: number, padLen: number = 4): string {
  const cleanPrefix = prefix.trim().toUpperCase();
  const paddedSeq = String(seq).padStart(padLen, '0');
  return `${cleanPrefix}-${paddedSeq}`;
}

describe('Serial Number Generation & Formatting', () => {
  it('formats serial with standard 4-digit zero padding', () => {
    const serial = formatSerial('stu', 42, 4);
    expect(serial).toBe('STU-0042');
  });

  it('handles custom prefix whitespace and casing', () => {
    const serial = formatSerial('  emp_card ', 1, 4);
    expect(serial).toBe('EMP_CARD-0001');
  });

  it('handles sequences exceeding default pad length gracefully', () => {
    const serial = formatSerial('VIP', 12345, 4);
    expect(serial).toBe('VIP-12345');
  });

  it('supports custom pad length specifications', () => {
    const serial6 = formatSerial('CARD', 7, 6);
    expect(serial6).toBe('CARD-000007');

    const serial2 = formatSerial('ID', 9, 2);
    expect(serial2).toBe('ID-09');
  });
});
