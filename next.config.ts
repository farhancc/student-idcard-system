import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' local:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https://res.cloudinary.com https://api.qrserver.com https://*.cloudflarestorage.com https://*.r2.cloudflarestorage.com data: blob: local:; connect-src 'self' https://res.cloudinary.com https://api.qrserver.com https://*.cloudflarestorage.com https://*.r2.cloudflarestorage.com https://*.sentry.io local:; font-src 'self' data: https://fonts.gstatic.com; frame-src 'self' local:; frame-ancestors 'self';",
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  serverExternalPackages: ['canvas', 'sharp', 'pdfjs-dist'],
  outputFileTracingExcludes: {
    '*': [
      './node_modules/canvas/**/*',
      'node_modules/canvas/**/*',
      '**/node_modules/canvas/**/*',
      './desktop-client/**/*',
      './artifacts/**/*',
      './model_photos/**/*',
      './scripts/**/*',
      './.git/**/*',
      './id card setting.pdf',
      './sample_photos.zip',
    ],
    'api/jobs/**/*': [
      './node_modules/canvas/**/*',
      'node_modules/canvas/**/*',
      '**/node_modules/canvas/**/*',
      './node_modules/sharp/**/*',
      'node_modules/sharp/**/*',
      '**/node_modules/sharp/**/*',
    ],
    'api/jobs/**': [
      './node_modules/canvas/**/*',
      'node_modules/canvas/**/*',
      '**/node_modules/canvas/**/*',
      './node_modules/sharp/**/*',
      'node_modules/sharp/**/*',
      '**/node_modules/sharp/**/*',
    ],
    '/api/jobs/**/*': [
      './node_modules/canvas/**/*',
      'node_modules/canvas/**/*',
      '**/node_modules/canvas/**/*',
      './node_modules/sharp/**/*',
      'node_modules/sharp/**/*',
      '**/node_modules/sharp/**/*',
    ],
    '/api/jobs/**': [
      './node_modules/canvas/**/*',
      'node_modules/canvas/**/*',
      '**/node_modules/canvas/**/*',
      './node_modules/sharp/**/*',
      'node_modules/sharp/**/*',
      '**/node_modules/sharp/**/*',
    ],
    'api/press/**/*': [
      './node_modules/canvas/**/*',
      'node_modules/canvas/**/*',
      '**/node_modules/canvas/**/*',
      './node_modules/sharp/**/*',
      'node_modules/sharp/**/*',
      '**/node_modules/sharp/**/*',
    ],
    '/api/press/**/*': [
      './node_modules/canvas/**/*',
      'node_modules/canvas/**/*',
      '**/node_modules/canvas/**/*',
      './node_modules/sharp/**/*',
      'node_modules/sharp/**/*',
      '**/node_modules/sharp/**/*',
    ],
    'api/superadmin/**/*': [
      './node_modules/canvas/**/*',
      'node_modules/canvas/**/*',
      '**/node_modules/canvas/**/*',
      './node_modules/sharp/**/*',
      'node_modules/sharp/**/*',
      '**/node_modules/sharp/**/*',
    ],
    '/api/superadmin/**/*': [
      './node_modules/canvas/**/*',
      'node_modules/canvas/**/*',
      '**/node_modules/canvas/**/*',
      './node_modules/sharp/**/*',
      'node_modules/sharp/**/*',
      '**/node_modules/sharp/**/*',
    ],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "student-id-pdf-system",
  project: "student-id-pdf-system",
  widenClientFileUpload: true,
});
