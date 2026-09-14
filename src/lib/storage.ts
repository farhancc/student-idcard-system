import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

// ── Environment Variables for Cloudflare R2 ─────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'idexo-card-photos';
const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, '');

export const isR2Configured = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
);

// ── Lazy Initialized S3 Client for R2 ───────────────────────────────────────
let _s3Client: S3Client | null = null;

function getR2Client(): S3Client | null {
  if (!isR2Configured) return null;
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3Client;
}

export interface UploadOptions {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

export interface PresignedUrlOptions {
  key: string;
  contentType: string;
  expiresIn?: number; // default 3600s (1 hr)
}

export interface PresignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

/**
 * Upload an object directly to Cloudflare R2 (or fallback to local disk in dev).
 * @returns Public URL of the uploaded object.
 */
export async function uploadToR2({ key, body, contentType }: UploadOptions): Promise<string> {
  const client = getR2Client();

  if (client) {
    try {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
      });
      await client.send(command);

      if (R2_PUBLIC_DOMAIN) {
        return `${R2_PUBLIC_DOMAIN}/${key}`;
      }
      return `/api/uploads/${key}`;
    } catch (err: any) {
      console.warn('[Storage] Cloudflare R2 upload failed (Network/DNS/R2 error). Falling back to local disk storage:', err?.message || err);
    }
  }

  // ── Local Fallback (for local development when R2 env vars are not set or when network is offline) ────
  const localDir = path.join(process.cwd(), 'public', 'uploads', path.dirname(key));
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  const localPath = path.join(process.cwd(), 'public', 'uploads', key);
  fs.writeFileSync(localPath, body);
  return `/uploads/${key}`;
}

/**
 * Generate a presigned PUT URL for direct browser-to-R2 upload.
 */
export async function getPresignedUploadUrl({
  key,
  contentType,
  expiresIn = 3600,
}: PresignedUrlOptions): Promise<PresignedUrlResult> {
  const client = getR2Client();
  const publicUrl = R2_PUBLIC_DOMAIN
    ? `${R2_PUBLIC_DOMAIN}/${key}`
    : `/api/uploads/${key}`;

  if (!client) {
    // Return dummy local upload endpoint if R2 is unconfigured in dev
    return {
      uploadUrl: `/api/upload?key=${encodeURIComponent(key)}`,
      publicUrl: `/uploads/${key}`,
      key,
    };
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return {
    uploadUrl,
    publicUrl,
    key,
  };
}

/**
 * Delete an object from R2 storage (or local disk fallback).
 */
export async function deleteFromR2(urlOrKey: string): Promise<boolean> {
  if (!urlOrKey) return false;
  const key = parseR2KeyFromUrl(urlOrKey);
  if (!key) return false;

  const client = getR2Client();
  if (client) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });
      await client.send(command);
      return true;
    } catch (err) {
      console.error(`Failed to delete key "${key}" from R2:`, err);
      return false;
    }
  }

  // Local fallback deletion
  try {
    const localPath = path.join(process.cwd(), 'public', 'uploads', key);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    return true;
  } catch (err) {
    console.error(`Failed to delete local file "${key}":`, err);
    return false;
  }
}

/**
 * Extract R2 object key from stored URL or path.
 */
export function parseR2KeyFromUrl(url: string): string | null {
  if (!url) return null;

  // Handle local /uploads/path/key.png
  if (url.startsWith('/uploads/')) {
    return url.replace('/uploads/', '');
  }

  // Handle Cloudinary URLs (legacy fallback parser)
  if (url.includes('cloudinary.com')) {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathPart = parts[1].replace(/^v\d+\//, '');
    return pathPart;
  }

  // Handle standard R2 or HTTP URLs
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/^\//, '');
    return pathname || null;
  } catch {
    return url.replace(/^\//, '');
  }
}
