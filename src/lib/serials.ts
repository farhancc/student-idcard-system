import { prisma } from './prisma';

/**
 * Assigns a unique sequential serial number for a client cardholder.
 * Uses an atomic database upsert on CardSerialCounter to prevent race conditions.
 */
export function assignSerialNumber(
  pressId: number,
  clientId: number,
  prefix: string,
  padLen: number = 4
): Promise<string> {
  const cleanPrefix = prefix.trim().toUpperCase();

  return prisma.cardSerialCounter
    .upsert({
      where: {
        pressId_clientId_prefix: {
          pressId,
          clientId,
          prefix: cleanPrefix,
        },
      },
      create: {
        pressId,
        clientId,
        prefix: cleanPrefix,
        lastSeq: 1,
        padLen,
      },
      update: {
        lastSeq: { increment: 1 },
      },
    })
    .then((counter) => {
      const paddedSeq = String(counter.lastSeq).padStart(counter.padLen, '0');
      return `${counter.prefix}-${paddedSeq}`; // e.g. "STU-0042"
    });
}
