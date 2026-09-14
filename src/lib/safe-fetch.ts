/**
 * Guards for the two ways untrusted input reaches an I/O call in this app:
 * a caller-supplied filesystem path, and a caller-supplied URL.
 *
 * Both exist because template/photo assets can live on disk, on R2, on
 * Cloudinary, or on a customer's own image host, and the caller says which.
 * Every consumer of that input must go through here — see the audit notes on
 * `/api/uploads`, `/api/proxy-image` and `/api/templates/analyze-pdf`, which
 * were each written with their own (or no) checks.
 */

import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import path from 'node:path';

export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

/** Opaque failure codes. Never echo these to a client — they are an oracle. */
export type AssetErrorCode =
  | 'INVALID_PATH'
  | 'INVALID_URL'
  | 'HOST_NOT_ALLOWED'
  | 'BLOCKED_ADDRESS'
  | 'TOO_MANY_REDIRECTS'
  | 'FETCH_FAILED'
  | 'TOO_LARGE'
  | 'TIMEOUT';

export class UnsafeAssetError extends Error {
  constructor(public readonly code: AssetErrorCode) {
    super(code);
    this.name = 'UnsafeAssetError';
  }
}

// ─── Filesystem containment ──────────────────────────────────────────────────

/**
 * Resolve `untrusted` under `baseDir` and return it only if it stayed inside.
 *
 * `path.resolve` collapses `..` before we test, so a prefix check is sufficient
 * — but note that percent-decoding happens upstream in the router, so a single
 * catch-all segment can arrive already containing `../`.
 */
export function resolveWithinDir(baseDir: string, untrusted: string): string | null {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, untrusted.replace(/^[/\\]+/, ''));
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

// ─── Address classification ──────────────────────────────────────────────────

function isPublicIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 0) return false;                        // 0.0.0.0/8   "this network"
  if (a === 10) return false;                       // 10/8        private
  if (a === 127) return false;                      // 127/8       loopback
  if (a === 169 && b === 254) return false;         // 169.254/16  link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return false;// 172.16/12   private
  if (a === 192 && b === 168) return false;         // 192.168/16  private
  if (a === 100 && b >= 64 && b <= 127) return false; // 100.64/10 CGNAT
  if (a === 198 && (b === 18 || b === 19)) return false; // 198.18/15 benchmarking
  if (a === 192 && b === 0) return false;           // 192.0.0/24 + 192.0.2/24
  if (a === 198 && b === 51) return false;          // 198.51.100/24 TEST-NET-2
  if (a === 203 && b === 0) return false;           // 203.0.113/24  TEST-NET-3
  if (a >= 224) return false;                       // multicast, reserved, broadcast
  return true;
}

function isPublicIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().split('%')[0];
  // IPv4-mapped / IPv4-compatible — judge by the embedded v4 address.
  const mapped = lower.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicIPv4(mapped[1]);
  if (lower === '::' || lower === '::1') return false;      // unspecified, loopback
  const head = parseInt(lower.split(':')[0] || '0', 16);
  if ((head & 0xfe00) === 0xfc00) return false;             // fc00::/7  unique-local
  if ((head & 0xffc0) === 0xfe80) return false;             // fe80::/10 link-local
  if ((head & 0xff00) === 0xff00) return false;             // ff00::/8  multicast
  return true;
}

/**
 * `URL.hostname` keeps the brackets on an IPv6 literal (`[::1]`), and
 * `net.isIP` does not accept them — so an unstripped host silently fails the
 * "is this an IP?" test and skips the range check entirely.
 */
export function unbracket(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

/** True only for addresses that are routable on the public internet. */
export function isPublicAddress(rawIp: string): boolean {
  const ip = unbracket(rawIp);
  const family = net.isIP(ip);
  if (family === 4) return isPublicIPv4(ip);
  if (family === 6) return isPublicIPv6(ip);
  return false;
}

/**
 * A `lookup` implementation that refuses to hand back a non-public address.
 *
 * Passing this to the agent — rather than resolving up-front and then calling
 * fetch — is what closes the DNS-rebinding window: it runs at connect time, on
 * the address the socket is actually about to use, on every redirect hop.
 */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: false }, (err, address, family) => {
    if (err) return callback(err, address, family);
    if (!isPublicAddress(address)) {
      return callback(new UnsafeAssetError('BLOCKED_ADDRESS') as NodeJS.ErrnoException, address, family);
    }
    callback(null, address, family);
  });
};

// ─── Remote fetch ────────────────────────────────────────────────────────────

export interface FetchAssetOptions {
  /** When set, the host must also appear here. Use for narrow, known sources. */
  allowedHosts?: ReadonlySet<string>;
  maxBytes?: number;
  timeoutMs?: number;
  /** Require the response's media type to start with one of these. */
  allowedContentTypePrefixes?: readonly string[];
}

export interface FetchedAsset {
  body: Buffer;
  contentType: string;
}

function requestOnce(
  url: URL,
  maxBytes: number,
  timeoutMs: number
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer; location?: string }> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(
      url,
      {
        method: 'GET',
        lookup: guardedLookup,
        timeout: timeoutMs,
        headers: {
          // Some image hosts 403 an unfamiliar agent.
          'user-agent': 'Mozilla/5.0 (compatible; idexo-asset-proxy)',
          accept: '*/*',
        },
      },
      res => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume(); // drain, we are not reading this body
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0), location: res.headers.location });
        }

        const declared = Number(res.headers['content-length'] ?? NaN);
        if (Number.isFinite(declared) && declared > maxBytes) {
          req.destroy();
          return reject(new UnsafeAssetError('TOO_LARGE'));
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            req.destroy();
            return reject(new UnsafeAssetError('TOO_LARGE'));
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new UnsafeAssetError('TIMEOUT'));
    });
    req.on('error', err => {
      reject(err instanceof UnsafeAssetError ? err : new UnsafeAssetError('FETCH_FAILED'));
    });
    req.end();
  });
}

/**
 * Fetch a remote asset that a caller named, without letting the caller reach
 * anything but the public internet.
 *
 * Redirects are followed manually so every hop is re-validated against the
 * same rules; the agent's guarded lookup covers the address, this loop covers
 * the scheme and the host allowlist.
 */
export async function fetchPublicAsset(
  rawUrl: string,
  options: FetchAssetOptions = {}
): Promise<FetchedAsset> {
  const {
    allowedHosts,
    maxBytes = MAX_ASSET_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    allowedContentTypePrefixes,
  } = options;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeAssetError('INVALID_URL');
  }

  for (let hop = 0; ; hop++) {
    if (hop > MAX_REDIRECTS) throw new UnsafeAssetError('TOO_MANY_REDIRECTS');

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new UnsafeAssetError('INVALID_URL');
    }
    if (allowedHosts && !allowedHosts.has(url.hostname)) {
      throw new UnsafeAssetError('HOST_NOT_ALLOWED');
    }
    // An IP literal never reaches the lookup hook, so check it here too.
    const host = unbracket(url.hostname);
    if (net.isIP(host) && !isPublicAddress(host)) {
      throw new UnsafeAssetError('BLOCKED_ADDRESS');
    }

    const res = await requestOnce(url, maxBytes, timeoutMs);

    if (res.location) {
      try {
        url = new URL(res.location, url);
      } catch {
        throw new UnsafeAssetError('INVALID_URL');
      }
      continue;
    }

    if (res.status < 200 || res.status >= 300) throw new UnsafeAssetError('FETCH_FAILED');

    const contentType = String(res.headers['content-type'] ?? 'application/octet-stream')
      .split(';')[0]
      .trim()
      .toLowerCase();

    if (allowedContentTypePrefixes && !allowedContentTypePrefixes.some(p => contentType.startsWith(p))) {
      throw new UnsafeAssetError('FETCH_FAILED');
    }

    return { body: res.body, contentType };
  }
}
