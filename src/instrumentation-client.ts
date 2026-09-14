import * as Sentry from '@sentry/nextjs';

/**
 * Browser-side Sentry initialisation.
 *
 * Named `instrumentation-client` rather than `sentry.client.config` because the
 * latter is only wired up by @sentry/nextjs's webpack integration, and this
 * project builds with Turbopack — where, per the SDK's own deprecation notice,
 * the old filename does nothing.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  debug: false,
});
