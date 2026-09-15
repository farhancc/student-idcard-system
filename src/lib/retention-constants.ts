/**
 * Retention constants shared by server and browser code.
 *
 * Kept apart from `@/lib/retention` because that module imports Prisma; a client
 * component that needs one of these values must not drag the database client
 * into its bundle.
 */

/** Data older than this is eligible for the automatic archive-and-purge. */
export const RETENTION_MONTHS = 6;

/**
 * Cardholders handled per export/purge round trip.
 *
 * Bounded because a single export walks the whole batch. Exceeding it does not
 * silently truncate: `collectPurgeTargets` reports `totalInScope` and `hasMore`,
 * and callers repeat until the scope is drained.
 */
export const PURGE_BATCH_LIMIT = 5000;
