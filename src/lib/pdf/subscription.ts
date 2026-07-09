import { prisma } from '../prisma';

/**
 * Checks subscription limits and trial validation before executing print orders.
 */
export async function verifySubscriptionLimits(
  pressId: number,
  cardCount: number,
  pdfType: string
): Promise<{ allowed: boolean; reason?: string }> {
  const press = await prisma.press.findUnique({
    where: { id: pressId },
  });

  if (!press) {
    return { allowed: false, reason: 'Press tenant not found' };
  }

  if (!press.isActive) {
    return { allowed: false, reason: 'Your press account is suspended. Please contact admin.' };
  }

  return { allowed: true };
}
