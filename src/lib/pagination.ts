/**
 * Safely parses and clamps pagination limit parameters.
 *
 * @param rawLimit - Raw query parameter or input value
 * @param defaultLimit - Default limit if missing or invalid (default: 50)
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @returns Clamped integer between 1 and maxLimit
 */
export function clampLimit(
  rawLimit: unknown,
  defaultLimit: number = 50,
  maxLimit: number = 100
): number {
  const parsed = Number(rawLimit);
  if (isNaN(parsed) || !Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }
  return Math.min(Math.floor(parsed), maxLimit);
}
