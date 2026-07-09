import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth-edge';

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
  '/portal',
  '/api/portal',
  '/api/health',
  '/api/desktop/version',
  '/api/v1',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Check if route is public
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // 2. Check Super Admin paths
  if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin')) {
    const adminToken = request.cookies.get('super_auth_token')?.value;
    if (!adminToken) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized Super Admin' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/superadmin/login', request.url));
    }
    const payload = await verifyToken(adminToken);
    if (!payload || !payload.isSuperAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized Super Admin' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/superadmin/login', request.url));
    }
    return NextResponse.next();
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
      const isPostOrPut = request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE';

      // Block mutating API calls on orders/billing/invoices/clients
      if (isApiCall && isPostOrPut &&
        (pathname.includes('/api/orders') || pathname.includes('/api/billing') ||
         pathname.includes('/api/invoices') || pathname.includes('/api/clients') ||
         pathname.includes('/api/cardholders'))) {
        return NextResponse.json({ error: 'Forbidden: Designers cannot perform this action' }, { status: 403 });
      }

      // Block dashboard page navigation to anything except templates + settings
      if (!isApiCall) {
        const allowedPagePrefixes = ['/dashboard/templates', '/dashboard/settings'];
        const isAllowed = allowedPagePrefixes.some(p => pathname.startsWith(p));
        if (!isAllowed) {
          return NextResponse.redirect(new URL('/dashboard/templates', request.url));
        }
      }
    }

    // ── OPERATOR: no billing ──────────────────────────────────────────────────
    if (payload.role === 'OPERATOR') {
      const blocked = ['/api/billing', '/dashboard/billing'];
      if (blocked.some(b => pathname.startsWith(b))) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden: Operators cannot access billing' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // Inject user context headers to avoid re-verifying in route handlers (optional but fast)
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', String(payload.userId));
    requestHeaders.set('x-press-id', String(payload.pressId));
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-user-name', encodeURIComponent(payload.name || 'Operator'));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/superadmin/:path*',
    '/api/:path*',
  ],
};
