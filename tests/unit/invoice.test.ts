import { describe, it, expect } from 'vitest';

export interface InvoiceCalculation {
  pricePerCard: number;
  cardCount: number;
  taxPercent: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export function calculateInvoice(
  pricePerCard: number,
  cardCount: number,
  taxPercent: number = 0
): InvoiceCalculation {
  const subtotal = Math.round(pricePerCard * cardCount * 100) / 100;
  const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

  return {
    pricePerCard,
    cardCount,
    taxPercent,
    subtotal,
    taxAmount,
    totalAmount,
  };
}

export function determinePaymentStatus(
  totalAmount: number,
  paidAmount: number
): 'UNPAID' | 'PARTIAL' | 'PAID' {
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount >= totalAmount) return 'PAID';
  return 'PARTIAL';
}

describe('Invoice & Billing Calculations', () => {
  describe('calculateInvoice', () => {
    it('calculates subtotal and total without tax correctly', () => {
      const calc = calculateInvoice(15.5, 100, 0);
      expect(calc.subtotal).toBe(1550);
      expect(calc.taxAmount).toBe(0);
      expect(calc.totalAmount).toBe(1550);
    });

    it('calculates GST/tax correctly', () => {
      const calc = calculateInvoice(20.0, 50, 18); // 18% GST
      expect(calc.subtotal).toBe(1000);
      expect(calc.taxAmount).toBe(180);
      expect(calc.totalAmount).toBe(1180);
    });

    it('handles decimal precision rounding', () => {
      const calc = calculateInvoice(12.33, 33, 5);
      expect(calc.subtotal).toBe(406.89);
      expect(calc.taxAmount).toBe(20.34);
      expect(calc.totalAmount).toBe(427.23);
    });
  });

  describe('determinePaymentStatus', () => {
    it('returns UNPAID when zero or negative paid amount', () => {
      expect(determinePaymentStatus(1000, 0)).toBe('UNPAID');
    });

    it('returns PARTIAL when paid amount is greater than zero but less than total', () => {
      expect(determinePaymentStatus(1000, 500)).toBe('PARTIAL');
    });

    it('returns PAID when paid amount equals or exceeds total', () => {
      expect(determinePaymentStatus(1000, 1000)).toBe('PAID');
      expect(determinePaymentStatus(1000, 1050)).toBe('PAID');
    });
  });
});
