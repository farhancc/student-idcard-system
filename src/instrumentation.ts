import * as Sentry from '@sentry/nextjs';

/**
 * Server and edge Sentry initialisation.
 *
 * @sentry/nextjs v10 does not pick `sentry.server.config` / `sentry.edge.config`
 * up on its own — they are only loaded if this hook imports them. Without this
 * file the SDK is configured at build time (source maps and all) but never
 * initialises at runtime, so nothing is ever reported.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

/** Report errors thrown inside route handlers and server components. */
export const onRequestError = Sentry.captureRequestError;
