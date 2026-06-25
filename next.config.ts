import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['canvas', 'sharp'],
  outputFileTracingExcludes: {
    '*': [
      './desktop-client/**/*',
      './artifacts/**/*',
      './model_photos/**/*',
      './scripts/**/*',
      './.git/**/*',
      './id card setting.pdf',
      './sample_photos.zip',
    ],
    '/api/jobs/**/*': [
      '**/node_modules/canvas/**/*',
      '**/node_modules/sharp/**/*',
    ],
    '/api/orders/**/*': [
      '**/node_modules/canvas/**/*',
      '**/node_modules/sharp/**/*',
    ],
    '/api/press/**/*': [
      '**/node_modules/canvas/**/*',
      '**/node_modules/sharp/**/*',
    ],
    '/api/superadmin/**/*': [
      '**/node_modules/canvas/**/*',
      '**/node_modules/sharp/**/*',
    ],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "student-id-pdf-system",
  project: "student-id-pdf-system",
  widenClientFileUpload: true,
  disableLogger: true,
});
