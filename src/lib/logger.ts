import pino from 'pino';

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
    censor: '[REDACTED]'
  }
});

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
