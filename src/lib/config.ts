const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

// In production mode, Stripe integration credentials are also mandatory
if (process.env.NODE_ENV === 'production') {
  requiredEnvVars.push('STRIPE_SECRET_KEY');
  requiredEnvVars.push('STRIPE_WEBHOOK_SECRET');
}

const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || process.env.SKIP_ENV_VALIDATION === 'true';

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    if (isBuildTime) {
      console.warn(`[Build Context] Required environment variable "${envVar}" is missing.`);
    } else {
      throw new Error(`CRITICAL CONFIGURATION ERROR: Required environment variable "${envVar}" is missing.`);
    }
  }
}

export const config = {
  jwtSecret: process.env.JWT_SECRET!,
  databaseUrl: process.env.DATABASE_URL!,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
};
