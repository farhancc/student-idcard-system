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
