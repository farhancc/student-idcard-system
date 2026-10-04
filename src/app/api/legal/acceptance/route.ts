import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { acceptanceContextFromRequest, recordLegalAcceptance } from '@/lib/legal/acceptance';

export const dynamic = 'force-dynamic';

/**
 * Accept the current version of every document required of a press user.
 *
 * The body carries no versions: which versions are being accepted is decided
 * here, from what is published, so a stale tab cannot accept an old version and
 * a crafted request cannot accept a version that was never shown.
 */
export async function POST(request: Request) {
  const auth = requireActor(request);
  if ('response' in auth) return auth.response;
  const { userId, pressId } = auth.actor;

  try {
    await recordLegalAcceptance({
      point: 'PRESS_SIGNUP',
      subjectType: 'PRESS_USER',
      subjectId: userId,
      pressId,
      context: acceptanceContextFromRequest(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Legal acceptance error:', error);
    return NextResponse.json({ error: 'Failed to record acceptance' }, { status: 500 });
  }
}
