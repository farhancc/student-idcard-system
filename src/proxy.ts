import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth-edge';
import {
  INJECTED_HEADER_NAMES,
  MIDDLEWARE_HEADERS,
  MiddlewareContext,
  SIGNATURE_HEX_LENGTH,
  middlewareSigPayload,
} from './lib/middleware-context';

// Define public routes that don't need auth
const publicRoutes = [
  '/login',
  '/signup',
  '/client-signup',
  '/superadmin/login',
  '/api/press/login',
  '/api/press/signup',
  '/api/public/client-signup',
  '/api/superadmin/login',
  '/api/billing/stripe-webhook',
  '/portal',
  '/api/portal',
  '/api/health',
  '/api/cron',
  '/api/desktop/version',
  '/api/uploads',
  '/api/v1',
];

/** Match on segment boundaries so `/api/v1` cannot be reached as `/api/v1x`. */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

/**
 * Drop any copy of the headers this middleware owns.
 *
 * Everything downstream treats these as proof of identity and tenancy, so a
 * client-supplied copy must never survive — including on routes that return
 * early without injecting a real one.
 */
function stripInjectedHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  for (const name of INJECTED_HEADER_NAMES) headers.delete(name);
  return headers;
}

async function signContext(ctx: MiddlewareContext): Promise<string> {
  const secret = process.env.JWT_SECRET || 'dev-middleware-secret';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(middlewareSigPayload(ctx)));
  return Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, SIGNATURE_HEX_LENGTH);
}

/** Forward the request with a freshly signed context replacing anything the client sent. */
async function forwardWithContext(
  request: NextRequest,
  ctx: MiddlewareContext,
  name: string
): Promise<NextResponse> {
  const headers = stripInjectedHeaders(request);
  headers.set(MIDDLEWARE_HEADERS.userId, String(ctx.userId));
  headers.set(MIDDLEWARE_HEADERS.pressId, String(ctx.pressId));
  headers.set(MIDDLEWARE_HEADERS.role, ctx.role);
  headers.set(MIDDLEWARE_HEADERS.scope, ctx.scope);
  headers.set(MIDDLEWARE_HEADERS.name, encodeURIComponent(name));
  headers.set(MIDDLEWARE_HEADERS.signature, await signContext(ctx));
  return NextResponse.next({ request: { headers } });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Public routes still get their forged headers stripped — the tenant
  //    resolver reads them, and nothing else on this path overwrites them.
  if (publicRoutes.some(route => matchesPrefix(pathname, route))) {
    return NextResponse.next({ request: { headers: stripInjectedHeaders(request) } });
  }

  // 1b. CSRF Protection: Validate Origin header for state-mutating API requests
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if (isMutation && pathname.startsWith('/api/')) {
    const csrfExemptPrefixes = [
      '/api/billing/stripe-webhook',
      '/api/cron',
      '/api/v1',
      '/api/desktop',
      '/api/health',
    ];
    const isExempt = csrfExemptPrefixes.some(p => matchesPrefix(pathname, p));

    if (!isExempt) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');

      if (!origin || !host) {
        return NextResponse.json(
          { error: 'Forbidden: Missing Origin header (CSRF check failed)' },
          { status: 403 }
        );
      }

      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json(
            { error: 'Forbidden: Invalid request origin (CSRF check failed)' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Forbidden: Malformed Origin header' },
          { status: 403 }
        );
      }
    }
  }

  // 2. Check Super Admin paths
  if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin')) {
    const adminToken = request.cookies.get('super_auth_token')?.value;
    const payload = adminToken ? await verifyToken(adminToken) : null;

    if (!payload || !payload.isSuperAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized Super Admin' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/superadmin/login', request.url));
    }

    // Superadmin genuinely operates across tenants. Asserting that as a signed
    // header is what lets the Prisma extension skip tenant filtering without
    // every superadmin route wrapping itself in withSystemContext().
    return forwardWithContext(
      request,
      { userId: Number(payload.userId) || 0, pressId: 0, role: 'SUPERADMIN', scope: 'system' },
      payload.name || 'SuperAdmin'
    );
  }

  // 3. Check Press User paths (/dashboard, /api/press/..., etc.)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
    let token = request.cookies.get('press_auth_token')?.value;

    if (!token && pathname.startsWith('/api/')) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const payload = await verifyToken(token);
    if (!payload) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized Session' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // ── DESIGNER: only allowed on /dashboard/templates and /dashboard/settings ──
    if (payload.role === 'DESIGNER') {
      const isApiCall = pathname.startsWith('/api/');
      // Allowlist the safe methods rather than blocklisting unsafe ones, so any
      // method added later (PATCH, and anything after it) is blocked by default.
      const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);

      // Block mutating API calls on the money- and record-touching surfaces.
      // /api/jobs is here because job creation spends the press's credits.
      const designerBlockedApis = [
        '/api/orders', '/api/billing', '/api/invoices',
        '/api/clients', '/api/cardholders', '/api/jobs',
      ];
      if (isApiCall && isMutation && designerBlockedApis.some(p => matchesPrefix(pathname, p))) {
        return NextResponse.json({ error: 'Forbidden: Designers cannot perform this action' }, { status: 403 });
      }

      // Block dashboard page navigation to anything except templates + settings
      if (!isApiCall) {
        const allowedPagePrefixes = ['/dashboard/templates', '/dashboard/settings'];
        const isAllowed = allowedPagePrefixes.some(p => matchesPrefix(pathname, p));
        if (!isAllowed) {
          return NextResponse.redirect(new URL('/dashboard/templates', request.url));
        }
      }
    }

    // ── OPERATOR: no billing ──────────────────────────────────────────────────
    if (payload.role === 'OPERATOR') {
      const blocked = ['/api/billing', '/dashboard/billing'];
      if (blocked.some(b => matchesPrefix(pathname, b))) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden: Operators cannot access billing' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    return forwardWithContext(
      request,
      {
        userId: Number(payload.userId),
        pressId: Number(payload.pressId),
        role: payload.role,
        scope: 'tenant',
      },
      payload.name || 'Operator'
    );
  }

  return NextResponse.next({ request: { headers: stripInjectedHeaders(request) } });
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/superadmin/:path*',
    '/api/:path*',
  ],
};
