import { prisma } from './prisma';

/**
 * Assigns a unique sequential serial number for a client cardholder.
 * Uses a transactional increment on CardSerialCounter to prevent race conditions.
 */
export async function assignSerialNumber(
  pressId: number,
  clientId: number,
  prefix: string,
  padLen: number = 4
): Promise<string> {
  const cleanPrefix = prefix.trim().toUpperCase();

  const counter = await prisma.$transaction(async (tx) => {
    // 1. Find or create the counter
    let ctr = await tx.cardSerialCounter.findUnique({
      where: {
        pressId_clientId_prefix: {
          pressId,
          clientId,
          prefix: cleanPrefix,
        },
      },
    });

    if (!ctr) {
      ctr = await tx.cardSerialCounter.create({
        data: {
          pressId,
          clientId,
          prefix: cleanPrefix,
          lastSeq: 0,
          padLen,
        },
      });
    }

    // 2. Increment and update
    const updatedCtr = await tx.cardSerialCounter.update({
      where: { id: ctr.id },
      data: { lastSeq: { increment: 1 } },
    });

    return updatedCtr;
  });

  const paddedSeq = String(counter.lastSeq).padStart(counter.padLen, '0');
  return `${counter.prefix}-${paddedSeq}`; // e.g. "STU-0042"
}
