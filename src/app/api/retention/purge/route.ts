import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/authz';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { writeAuditLog, getActorFromRequest, AuditActions } from '@/lib/audit-log';
import { collectPurgeTargets, executePurge, verifyPurgeToken } from '@/lib/retention';

const purgeSchema = z.object({
  /** Issued by /api/retention/export inside the backup ZIP's manifest.json. */
  token: z.string().min(1),
  ids: z.array(z.number().int().positive()).min(1),
});

/**
 * Permanently delete a batch of backed-up data from Postgres and Cloudflare R2.
 *
 * Irreversible, so the scope is never taken from the caller: it comes from the
 * signed token the export route issued, and the token also pins the exact set of
 * ids that were written into the backup ZIP. A record whose photo failed to
 * archive is absent from that set and therefore cannot be destroyed here.
 *
 * Replaces `/api/archive/purge` and `/api/backup/purge`, which trusted a
 * client-supplied id list (populated even for failed downloads) and, in the
 * latter case, an unbounded `createdAt <= endDate` filter that reached far
 * beyond the month actually backed up.
 */
export async function POST(request: Request) {
  try {
    // Destroying tenant data is an owner's decision, not an operator's.
    const auth = requireRole(request, ['OWNER']);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const rl = await rateLimit(`purge:${pressId}:${getClientIp(request)}`, 5, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for data purge.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 });
    }

    const parsed = purgeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }
    const { token, ids } = parsed.data;

    const scope = await verifyPurgeToken(token, pressId, ids);
    if (!scope) {
      return NextResponse.json(
        {
          error:
            'Purge authorisation is invalid, expired, or does not match these records. ' +
            'Download a fresh backup and try again.',
        },
        { status: 403 }
      );
    }

    // Re-resolve against the DB rather than trusting the token's view of it, so
    // anything already deleted or moved out of scope simply drops out.
    const targets = await collectPurgeTargets(scope, { cardholderIds: ids, limit: ids.length });
    const result = await executePurge(targets);

    void writeAuditLog({
      ...getActorFromRequest(request),
      action: AuditActions.DATA_PURGED,
      category: 'SYSTEM',
      severity: 'CRITICAL',
      resourceType: 'Client',
      resourceId: scope.clientIds.join(','),
      description:
        `Purged ${result.cardholdersDeleted} cardholder(s), ${result.pdfJobsDeleted} PDF job(s) ` +
        `and ${result.filesDeleted} stored file(s) for client(s) ${scope.clientIds.join(', ')} ` +
        `created between ${scope.from.toISOString()} and ${scope.to.toISOString()}. ` +
        `${result.ordersArchived} order(s) archived; invoices and audit history retained.`,
      oldValue: {
        clientIds: scope.clientIds,
        from: scope.from.toISOString(),
        to: scope.to.toISOString(),
        cardholderIds: ids,
      },
      newValue: {
        ...result,
        // Recorded so orphaned objects can be swept later rather than lost silently.
        filesFailed: result.filesFailed,
      },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('Retention purge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
