import { NextResponse } from 'next/server';
import { fetchPublicAsset, UnsafeAssetError } from '@/lib/safe-fetch';

/**
 * CORS fallback for the client-side card renderer: it hands us an image URL it
 * could not load directly and we re-serve it same-origin.
 *
 * The URL is caller-supplied and hosts are not knowable in advance (customers
 * reference their own photo hosts), so this cannot use a host allowlist — the
 * protection is `fetchPublicAsset` refusing to connect to anything that is not
 * a public address, at connect time, on every redirect hop.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  let targetUrl = decodeURIComponent(imageUrl).trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return new Response('Invalid image URL scheme', { status: 400 });
  }

  // Google Drive share links → the direct-content host.
  if (targetUrl.includes('drive.google.com') || targetUrl.includes('docs.google.com')) {
    const match = targetUrl.match(/(?:file\/d\/|id=|\/d\/)([a-zA-Z0-9_-]{20,})/);
    if (match?.[1]) {
      targetUrl = `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }

  // R2's S3 endpoint is not publicly readable — /api/uploads is the route that
  // holds the bucket credentials. Redirect rather than calling ourselves: a
  // self-fetch would be a loopback connection, which the SSRF guard refuses.
  if (targetUrl.includes('.r2.cloudflarestorage.com/')) {
    const key = targetUrl.split('.r2.cloudflarestorage.com/')[1]?.split('?')[0];
    if (key) {
      return NextResponse.redirect(new URL(`/api/uploads/${key}`, request.url), 302);
    }
  }

  try {
    const asset = await fetchPublicAsset(targetUrl, {
      allowedContentTypePrefixes: ['image/'],
    });

    return new Response(new Uint8Array(asset.body), {
      status: 200,
      headers: {
        'Content-Type': asset.contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
        // Remote content re-served from our origin: an SVG must not run here.
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err) {
    // Opaque to the caller — the failure codes distinguish "blocked address"
    // from "not found", which is exactly the oracle we are refusing to be.
    if (!(err instanceof UnsafeAssetError)) {
      console.error('[ProxyImage] Unexpected error:', err);
    }
    return new Response('Unable to fetch image', { status: 502 });
  }
}
