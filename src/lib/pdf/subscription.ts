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

  const now = new Date();

  // 1. Check Trial limits (14 days or max 100 cards total)
  if (press.trialEndsAt && press.trialEndsAt > press.createdAt) {
    if (now > press.trialEndsAt) {
      return { allowed: false, reason: 'Your 14-day free trial has expired. Please upgrade to a paid plan.' };
    }

    // Count all print records generated during trial
    const totalPrinted = await prisma.cardPrintRecord.count({
      where: { pressId },
    });

    if (totalPrinted + cardCount > 100) {
      return { allowed: false, reason: `Trial limit exceeded. You can print up to 100 cards on trial (Printed: ${totalPrinted}, Attempting: ${cardCount}). Please upgrade.` };
    }
  }

  // 2. Check Plan limits
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyCount = await prisma.cardPrintRecord.count({
    where: {
      pressId,
      createdAt: { gte: startOfMonth },
    },
  });

  if (press.plan === 'BASIC') {
    // Basic limits
    if (pdfType === 'PRODUCTION') {
      return { allowed: false, reason: 'Production grid exports (with crop marks/bleeds) are only available on PRO plans and above.' };
    }
    if (cardCount > 500) {
      return { allowed: false, reason: 'BASIC plan limit: Maximum 500 cards per order.' };
    }
    if (monthlyCount + cardCount > 10000) {
      return { allowed: false, reason: 'BASIC plan limit: Maximum 10,000 cards per month exceeded.' };
    }
  } else if (press.plan === 'PRO') {
    // Pro limits
    if (cardCount > 2500) {
      return { allowed: false, reason: 'PRO plan limit: Maximum 2,500 cards per order.' };
    }
    if (monthlyCount + cardCount > 50000) {
      return { allowed: false, reason: 'PRO plan limit: Maximum 50,000 cards per month exceeded.' };
    }
  }

  return { allowed: true };
}
