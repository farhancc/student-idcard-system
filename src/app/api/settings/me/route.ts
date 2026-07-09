import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * GET /api/settings/me
 * Returns the current session user's role directly from the JWT cookie.
 * No DB query — cannot fail due to DB issues. Used by Settings page to
 * determine whether to show the Staff Management panel.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
        pressId: session.pressId,
      },
    });
  } catch (error) {
    console.error('Fetch session me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
