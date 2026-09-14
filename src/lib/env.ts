import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters for security'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CRON_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_DOMAIN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  // Skip strict validation during build (env vars may not be available yet)
  if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.SKIP_ENV_VALIDATION === 'true') {
    return envSchema.parse({
      ...process.env,
      // Provide build-time fallbacks only for the build phase
      JWT_SECRET: process.env.JWT_SECRET || 'build-time-placeholder-not-used-at-runtime',
    });
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables detected at startup:');
    for (const issue of result.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }

    // In production, crash immediately — never run with invalid config
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: Invalid environment variables in production. ' +
        'Fix the issues listed above before deploying.'
      );
    }

    // In dev/test, return fallback values with a warning
    return {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/idexo',
      JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-change-in-production-min-16-chars',
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      CRON_SECRET: process.env.CRON_SECRET,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      R2_PUBLIC_DOMAIN: process.env.R2_PUBLIC_DOMAIN,
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
      SENTRY_DSN: process.env.SENTRY_DSN,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    };
  }

  return result.data;
}

export const env = parseEnv();
