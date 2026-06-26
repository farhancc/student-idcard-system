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

// ── JWT secret entropy guard ──────────────────────────────────────────────────
// Minimum 32 characters to ensure sufficient entropy against brute-force.
// Generate a strong secret with: openssl rand -hex 32
const jwtSecret = process.env.JWT_SECRET ?? '';
const KNOWN_WEAK_PATTERNS = ['secret', 'password', 'change', 'example', 'press-token', 'super-secret'];

if (!isBuildTime) {
  if (jwtSecret.length < 32) {
    throw new Error(
      `CRITICAL SECURITY ERROR: JWT_SECRET is too short (${jwtSecret.length} chars). ` +
      `Minimum 32 characters required. Generate one with: openssl rand -hex 32`
    );
  }
  if (KNOWN_WEAK_PATTERNS.some(p => jwtSecret.toLowerCase().includes(p))) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `CRITICAL SECURITY ERROR: JWT_SECRET appears to be a weak/default value. ` +
        `Replace it with a cryptographically random string: openssl rand -hex 32`
      );
    } else {
      console.warn(
        `[Security Warning] JWT_SECRET appears to be a weak/default value. ` +
        `This is acceptable for local development but MUST be replaced before deploying to production.`
      );
    }
  }
}

export const config = {
  jwtSecret,
  databaseUrl: process.env.DATABASE_URL!,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
};
