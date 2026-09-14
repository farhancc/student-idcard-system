import pino from 'pino';
import * as Sentry from '@sentry/nextjs';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'password', 'token', 'key_hash', 'secret'],
    censor: '[REDACTED]',
  },
});

/**
 * Log structured API error with route, stack, and context metadata,
 * and report to Sentry for telemetry tracking.
 */
export function logApiError(route: string, error: unknown, context?: Record<string, any>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(
    {
      route,
      message,
      stack,
      ...context,
    },
    `[API Error] ${route}: ${message}`
  );
  try {
    Sentry.captureException(error, { extra: { route, ...context } });
  } catch {}
}

// Intercept and structure default console logs in production for full codebase observability
if (process.env.NODE_ENV === 'production' || process.env.STRUCTURED_LOGGING === 'true') {
  const formatArgs = (args: any[]) => {
    if (args.length === 1) {
      return args[0];
    }
    return args;
  };

  console.log = (...args) => logger.info(formatArgs(args));
  console.info = (...args) => logger.info(formatArgs(args));
  console.warn = (...args) => logger.warn(formatArgs(args));
  console.error = (...args) => logger.error(formatArgs(args));
}
