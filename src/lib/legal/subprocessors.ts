/**
 * The third parties that process customer data on our behalf.
 *
 * Defined once and rendered in both the Privacy Policy and Annex 2 of the DPA:
 * a subprocessor list that exists twice is a subprocessor list that is wrong in
 * one of the two places. Keep it in step with the integrations that are
 * actually wired up — every entry below corresponds to live code:
 *
 *   Cloudflare R2   src/lib/storage.ts
 *   Cloudinary      src/app/api/upload/sign/route.ts, src/lib/pdf/cache-manager.ts
 *   Upstash Redis   src/lib/rate-limit.ts, src/lib/token-blocklist.ts
 *   Stripe          src/app/api/billing/stripe-webhook/route.ts, src/lib/config.ts
 *   Sentry          sentry.server.config.ts, src/instrumentation-client.ts
 *   Google Fonts    src/app/layout.tsx
 */

export interface Subprocessor {
  name: string;
  /** Contracting entity's home jurisdiction. */
  entity: string;
  purpose: string;
  /** What categories of data it can see. */
  dataTouched: string;
  /** Where the processing happens, as configured. */
  location: string;
}

export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: 'Vercel',
    entity: 'Vercel Inc. (USA)',
    purpose: 'Application hosting, serverless execution and scheduled jobs',
    dataTouched: 'All data in transit through the application; request logs',
    location: 'Configured deployment region',
  },
  {
    name: 'Managed PostgreSQL provider',
    entity: 'As named in your Order Form',
    purpose: 'Primary database',
    dataTouched: 'Cardholder records, roster fields, account and billing records, audit logs',
    location: 'Configured database region',
  },
  {
    name: 'Cloudflare R2',
    entity: 'Cloudflare, Inc. (USA)',
    purpose: 'Object storage for photographs, template artwork and generated PDFs',
    dataTouched: 'Cardholder photographs, card artwork, generated PDF output',
    location: 'Cloudflare global object storage',
  },
  {
    name: 'Cloudinary',
    entity: 'Cloudinary Ltd. (Israel) / Cloudinary Inc. (USA)',
    purpose: 'Image upload, transformation and delivery; font and asset hosting',
    dataTouched: 'Cardholder photographs, template and logo images',
    location: 'Cloudinary global CDN',
  },
  {
    name: 'Upstash',
    entity: 'Upstash, Inc. (USA)',
    purpose: 'Rate limiting and revoked-session tracking',
    dataTouched: 'IP addresses, hashed session identifiers',
    location: 'Configured Upstash region',
  },
  {
    name: 'Stripe',
    entity: 'Stripe, Inc. (USA) / Stripe India',
    purpose: 'Payment processing for credit purchases and subscriptions',
    dataTouched: 'Billing contact details and payment metadata. Card numbers are collected by Stripe directly and never reach our servers.',
    location: 'Stripe global infrastructure',
  },
  {
    name: 'Sentry',
    entity: 'Functional Software, Inc. (USA)',
    purpose: 'Error and performance monitoring',
    dataTouched: 'Diagnostic data: stack traces, URLs, user agent, account identifiers. Not used for cardholder photographs.',
    location: 'Sentry (USA / EU region as configured)',
  },
  {
    name: 'Google Fonts',
    entity: 'Google LLC (USA)',
    purpose: 'Web font delivery for the template designer',
    dataTouched: 'IP address and user agent of the browser requesting a font',
    location: 'Google global CDN',
  },
];
