import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

const isCloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/** TTL for signed URLs (seconds). Default: 2 hours */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 2;

/**
 * Extracts the Cloudinary public_id from a full secure_url.
 * e.g. https://res.cloudinary.com/<cloud>/image/upload/v12345/press_1/photos/abc.jpg
 *   -> press_1/photos/abc
 */
function extractCloudinaryPublicId(url: string): string | null {
  try {
    const uploadIdx = url.indexOf('/upload/');
    if (uploadIdx === -1) return null;
    let afterUpload = url.slice(uploadIdx + '/upload/'.length);
    // Strip version segment (vXXXXXXXX/)
    afterUpload = afterUpload.replace(/^v\d+\//, '');
    // Strip file extension
    const lastDot = afterUpload.lastIndexOf('.');
    return lastDot !== -1 ? afterUpload.slice(0, lastDot) : afterUpload;
  } catch {
    return null;
  }
}

/**
 * Determine the Cloudinary resource type from the URL path.
 */
function extractCloudinaryResourceType(url: string): 'image' | 'raw' | 'video' {
  if (url.includes('/raw/upload/')) return 'raw';
  if (url.includes('/video/upload/')) return 'video';
  return 'image';
}

/**
 * Given any asset URL (Cloudinary or local), return a short-lived signed URL.
 *
 * - Cloudinary URLs → generate a private signed URL expiring in 2 hours.
 * - Local/relative URLs → generate an HMAC-signed token appended as `?sig=...&exp=...`
 *   that is validated in the download route.
 * - If Cloudinary is not configured, returns the original URL unchanged.
 */
export function generateSignedUrl(originalUrl: string, ttlSeconds = SIGNED_URL_TTL_SECONDS): string {
  if (!originalUrl) return originalUrl;

  // ── Cloudinary URL ───────────────────────────────────────────────
  if (originalUrl.includes('cloudinary.com') && isCloudinaryConfigured) {
    const publicId = extractCloudinaryPublicId(originalUrl);
    if (!publicId) return originalUrl;

    const resourceType = extractCloudinaryResourceType(originalUrl);
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'authenticated',
      sign_url: true,
      auth_token: {
        duration: ttlSeconds,
        start_time: Math.floor(Date.now() / 1000),
      },
      expires_at: expiresAt,
      secure: true,
    });
  }

  // ── Local / relative URL ─────────────────────────────────────────
  const secret = process.env.SIGNED_URL_SECRET || process.env.NEXTAUTH_SECRET || 'dev-secret-change-me';
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${originalUrl}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);

  const separator = originalUrl.includes('?') ? '&' : '?';
  return `${originalUrl}${separator}sig=${sig}&exp=${expiresAt}`;
}

/**
 * Validate an HMAC-signed local URL token.
 * Returns true if the signature is valid and the URL has not expired.
 */
export function validateSignedUrl(originalPath: string, sig: string, exp: string): boolean {
  const expiresAt = parseInt(exp, 10);
  if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
    return false; // Expired
  }

  const secret = process.env.SIGNED_URL_SECRET || process.env.NEXTAUTH_SECRET || 'dev-secret-change-me';
  const payload = `${originalPath}:${expiresAt}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);

  // Constant-time comparison to prevent timing attacks.
  // Ensure the buffers compared have the same byte length to avoid throwing a TypeError.
  if (typeof sig !== 'string' || sig.length !== expectedSig.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
}

