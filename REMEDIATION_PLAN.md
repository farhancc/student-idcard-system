# Remediation Plan

**Companion to:** `PRODUCTION_READINESS_AUDIT.md` (2026-09-09)
**Scope:** every finding in that audit, ordered for execution.
**Baseline:** commit `a80c8f1`, 113 uncommitted modified files, Next.js 16.2.7.

---

## How this plan is ordered

Not by severity — by **dependency and blast radius**. Three rules drove the sequence:

1. **Cheap, isolated, and actively exploitable goes first.** Phase 0 is four changes that are almost entirely deletions and guard clauses. None of them need CI, a staging database, or a refactor. They close the two worst holes in about an hour.
2. **Safety net before surgery.** Phase 1 makes changes verifiable (CI, a committed tree, migrations out of the build). Everything after Phase 1 is a real code change, and doing those without CI on a 113-file dirty tree is how regressions ship.
3. **The architectural fix comes late and deliberately.** Making tenant isolation fail *closed* (Phase 5) will break roughly 40 routes that legitimately query without a tenant header — the portal, the v1 API, superadmin, login, and the cron job you will have just re-enabled in Phase 2. It needs a staged migration, not a one-line change. Doing it early would stall everything else.

**One ordering trap, called out explicitly:** Phase 2 re-enables `/api/cron/cleanup`, which works *today only because tenant isolation fails open* — with no `x-press-id` header it sweeps every tenant's expired jobs, which is what a cron job should do. Phase 5 removes that behaviour. **The cron route must be converted to an explicit system context in the same change that flips the default, or nightly cleanup silently stops purging anything.** This is flagged again at items 2.2 and 5.3.

| Phase | Theme | Effort | Gate |
|---|---|---|---|
| 0 | Stop the bleeding | ~1 hour | Deploy immediately |
| 1 | Make change safe | ~1 day | CI green |
| 2 | Restore dead features | ~2 days | Payments + retention verified live |
| 3 | Close authorization gaps | ~2 days | Role matrix tested |
| 4 | Dependencies & infra | ~2 days | `npm audit` clean, Upstash live |
| 5 | Tenant isolation fail-closed | ~5–8 days | Zero null-context warnings for 7 days |
| 6 | Data integrity | ~3 days | Migrations applied |
| 7 | Hygiene & debt | ongoing | — |

**Launch gate:** Phases 0–4 complete. Phase 5 is the difference between "defensible" and "sound", and should not be skipped, but it does not have to block a launch that Phases 0–4 have made safe.

---

# Phase 0 — Stop the bleeding (~1 hour, deploy today)

No dependencies. Deletions and guard clauses only. Do this before anything else, including before committing the working tree.

---

### 0.1 — Delete `/api/test-db` *(audit C2)*

**File:** `src/app/api/test-db/route.ts`, `src/middleware.ts:20`

Unauthenticated. Returns the `information_schema` table listing, `press`/`pressUser` row counts, and 50 rows of `card_templates` joined to press names and prices.

**Fix — two deletions:**

```bash
rm -rf src/app/api/test-db
```

```diff
--- a/src/middleware.ts
@@ const publicRoutes = [
   '/api/desktop/version',
   '/api/v1',
-  '/api/test-db',
 ];
```

**Verify:** `curl -i https://<host>/api/test-db` → `404`.

**Risk:** none. Confirm nothing references it first — it is a debug endpoint with no UI caller.

---

### 0.2 — Harden `/api/templates/analyze-pdf` *(audit C1)*

**File:** `src/app/api/templates/analyze-pdf/route.ts:31-44`, caller at `:119-122`

`originalUrl` comes from the request body and reaches both `fetch()` (SSRF — no allowlist, no timeout, no size cap, follows redirects) and `path.join(cwd,'public',url)` + `readFileSync` (traversal — `/../../etc/passwd` escapes `public/`). The catch block echoes the resolved absolute path back to the caller, making it a file-existence oracle.

Reachable by every authenticated role including `DESIGNER`, because the middleware blocklist does not cover `/api/templates`. That access is *legitimate* — designers analyse templates — so the fix is hardening, not blocking.

**Fix — replace `getPdfBuffer` entirely:**

```ts
import path from 'path';
import fsp from 'fs/promises';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

// Only the media host we actually store templates on.
const ALLOWED_HOSTS = new Set(['res.cloudinary.com']);

/** Load a PDF from an allowlisted remote host or a path contained within public/. */
async function getPdfBuffer(rawUrl: string): Promise<Buffer> {
  if (rawUrl.startsWith('/')) {
    const resolved = path.resolve(PUBLIC_DIR, rawUrl.replace(/^\/+/, ''));
    // Containment check — path.resolve has already collapsed any ../ segments.
    if (resolved !== PUBLIC_DIR && !resolved.startsWith(PUBLIC_DIR + path.sep)) {
      throw new Error('INVALID_PATH');
    }
    const stat = await fsp.stat(resolved).catch(() => null);
    if (!stat?.isFile()) throw new Error('NOT_FOUND');
    if (stat.size > MAX_PDF_BYTES) throw new Error('TOO_LARGE');
    return fsp.readFile(resolved);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('INVALID_URL');
  }
  if (parsed.protocol !== 'https:') throw new Error('INVALID_URL');
  if (!ALLOWED_HOSTS.has(parsed.hostname)) throw new Error('HOST_NOT_ALLOWED');

  const res = await fetch(parsed, {
    redirect: 'error', // a 30x must not be able to leave the allowlist
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('FETCH_FAILED');

  const declared = Number(res.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_PDF_BYTES) throw new Error('TOO_LARGE');

  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_PDF_BYTES) throw new Error('TOO_LARGE');
  return Buffer.from(ab);
}
```

**And stop leaking the reason to the caller** (`:120-122`):

```diff
     } catch (err: any) {
-      return NextResponse.json({ error: `Could not load PDF: ${err.message}` }, { status: 400 });
+      console.error('analyze-pdf: source load failed', { code: err?.message });
+      return NextResponse.json({ error: 'Could not load the source PDF' }, { status: 400 });
     }
```

The thrown values are deliberately opaque codes, not messages — they go to the log, never the response.

**Verify:**
- `{"originalUrl":"/../../etc/passwd","cardWidth":100,"cardHeight":100}` → `400`, body says only "Could not load the source PDF", server log shows `INVALID_PATH`.
- `{"originalUrl":"http://169.254.169.254/latest/meta-data/"}` → `400` / `INVALID_URL` (not https).
- `{"originalUrl":"https://example.com/x.pdf"}` → `400` / `HOST_NOT_ALLOWED`.
- A real `https://res.cloudinary.com/...` template PDF → still analyses correctly. **This is the regression test that matters** — run it against a genuine template before deploying.

**Note:** if templates are also served from a second host (a custom Cloudinary CNAME, an S3 bucket), add it to `ALLOWED_HOSTS`. Check `CLOUDINARY_CLOUD_NAME` usage and a sample of `card_templates.front_original_url` values in production before shipping, or you will break template analysis.

---

### 0.3 — Restrict `/api/jobs/cleanup` to OWNER *(audit C4, second half)*

**File:** `src/app/api/jobs/cleanup/route.ts`

> **Changed during execution — originally "delete this route".** The pre-flight grep found a live UI caller: the "Purge Expired Files" button in `src/app/dashboard/settings/page.tsx:571` (`handleTriggerCleanup`). Because `/api/cron/cleanup` is still 401'd by middleware and nothing is scheduled, **this route is currently the only working retention path**, against a backlog that has been accumulating since launch. Deleting it in Phase 0 would leave zero cleanup capability until item 2.2 lands.

Its own comment said *"In this basic version, we allow running it via post request."* No auth check, no role check — any authenticated user of any role could trigger a destructive purge. It is tenant-scoped by the Prisma extension, so it only ever purged the caller's own expired jobs, which is why this was contained rather than critical.

**Fix applied — close the privilege gap, keep the capability:**

```ts
const pressId = request.headers.get('x-press-id');
const role = request.headers.get('x-user-role');
if (!pressId || !role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
if (role !== 'OWNER') return NextResponse.json({ error: 'Forbidden: owners only' }, { status: 403 });
```

OWNER-only matches the UI's own warning that the action cannot be undone.

**Deferred to item 2.2:** delete the route *and* the settings-page button once the scheduled cron replaces it.

**Verify:** DESIGNER and OPERATOR → `403`; OWNER → `200` and the button still works.

---

### 0.4 — Close the `PATCH` gap in the DESIGNER blocklist *(audit H2, partial)*

**File:** `src/middleware.ts:79`

```ts
const isPostOrPut = request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE';
```

`PATCH` is missing. No current route exploits it, so this is pre-emptive — but it is a one-line change that closes a trap for the next `PATCH` handler added under `/api/orders`, `/api/clients`, or `/api/cardholders`.

**Fix:**

```diff
-      const isPostOrPut = request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE';
+      const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
```

Allowlisting safe methods rather than blocklisting unsafe ones means the next method added to HTTP is handled correctly by default. Update the two usages below it.

**Verify:** `PATCH /api/orders/1` as a DESIGNER → `403`. `GET /api/orders` as a DESIGNER → still `200`.

> This is a stopgap. The real fix is item 3.1 — authorization enforced in routes, not by substring-matching paths in middleware.

---

# Phase 1 — Make change safe (~1 day)

Everything after this phase modifies live behaviour. Do not start Phase 2 until CI is green.

---

### 1.1 — Commit the working tree

113 modified files are uncommitted. What is deployed cannot be reconstructed from git, which means no rollback target and no meaningful review of anything that follows.

```bash
git status --porcelain | wc -l      # confirm the count
git add -A && git commit -m "chore: commit working state prior to remediation"
```

Review the diff before committing. If it contains unrelated work-in-progress, split it — but do not leave it uncommitted.

---

### 1.2 — Remove `prisma migrate deploy` from the build *(audit M9)*

**File:** `package.json:8`

```json
"build": "export DIRECT_URL=\"$DATABASE_URL\" && prisma migrate deploy && prisma generate && next build"
```

Every build — including preview deploys — applies migrations to whatever `DATABASE_URL` points at. A preview deploy can migrate production. There is no rollback path.

**Fix:**

```diff
-    "build": "export DIRECT_URL=\"$DATABASE_URL\" && prisma migrate deploy && prisma generate && next build",
+    "build": "export DIRECT_URL=\"$DATABASE_URL\" && prisma generate && next build",
+    "db:deploy": "export DIRECT_URL=\"$DATABASE_URL\" && prisma migrate deploy",
```

Migrations become a deliberate release step run against production only, from CI or by hand.

**Verify:** `npm run build` succeeds without touching the database. Confirm `prisma generate` still runs (the client must exist at build time).

---

### 1.3 — Add CI *(audit L3)*

No `.github/workflows` exists. Build, typecheck, tests, lint, and `npm audit` currently pass or fail only on a developer's machine.

**File:** `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx prisma generate
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: npx next build
        env:
          SKIP_ENV_VALIDATION: 'true'
      - run: npm audit --omit=dev --audit-level=high
      # Lint is advisory until the 876 existing errors are burned down (item 7.1).
      - run: npx eslint || true
```

`npm ci` runs `postinstall`, which invokes `prisma generate` against `DIRECT_URL` — it does not need a reachable database, but confirm on the first run. `next build` needs `SKIP_ENV_VALIDATION=true` because `src/lib/config.ts` enforces JWT secret entropy at boot.

**Verify:** open a trivial PR and confirm all five steps run. `npm audit` will **fail** until Phase 4 — that is correct and is the point.

---

### 1.4 — Track `.env.example` *(audit L1)*

`.gitignore` matches `.env*`, so the environment template is not in the repository. A new deployment has no list of required variables.

```diff
--- a/.gitignore
 .env*
+!.env.example
```

Then commit `.env.example` with every key name and **no values**. Cross-check it against `src/lib/config.ts` so the two cannot drift.

---

# Phase 2 — Restore dead features (~2 days)

Two shipped features do not work at all in production. Neither is a code bug in the feature — both are routing.

---

### 2.1 — Make the Stripe webhook reachable *(audit C3)*

**Files:** `src/middleware.ts:6-21`, `src/app/api/billing/stripe-webhook/route.ts:37-45`

`/api/billing/stripe-webhook` is not in `publicRoutes`, so middleware requires a `press_auth_token` cookie or a JWT bearer. Stripe sends neither, so **every webhook is 401'd before the handler runs**. `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated` and `customer.subscription.deleted` are all silently dropped: customers pay and are never upgraded, cancellations never downgrade.

The handler's own `stripe.webhooks.constructEvent` signature check is correct and mandatory in production — that signature *is* the authentication boundary, which is why the route belongs in `publicRoutes`.

**Fix A — routing:**

```diff
--- a/src/middleware.ts
   '/api/superadmin/login',
+  '/api/billing/stripe-webhook',
   '/portal',
```

Place it **before** `/api/billing` could ever be added to the list, and note that `publicRoutes` uses `startsWith` — this entry is specific enough not to widen anything.

**Fix B — the match-everything `OR`** (`route.ts:37-45`). When `customerEmail` is empty, `{ email: undefined }` has its field dropped by Prisma, leaving `{}` in the `OR`, which matches **every row**. `findFirst` then upgrades an arbitrary press to a paid plan.

```diff
-      let press = await prisma.press.findFirst({
-        where: {
-          OR: [
-            { stripeCustomerId },
-            { email: customerEmail || undefined },
-          ],
-        },
-      });
+      const matchers: Prisma.PressWhereInput[] = [];
+      if (stripeCustomerId) matchers.push({ stripeCustomerId });
+      if (customerEmail) matchers.push({ email: customerEmail });
+      if (matchers.length === 0) {
+        console.error('Stripe webhook: no usable identifier on event; ignoring');
+        return;
+      }
+      const press = await prisma.press.findFirst({ where: { OR: matchers } });
```

`press` was declared `let` and never reassigned — make it `const`.

**Verify:**
1. `stripe listen --forward-to localhost:3000/api/billing/stripe-webhook` and trigger `checkout.session.completed`. Confirm a `200` and the plan change in the database.
2. Send a request with a **bad** signature → expect `400` "signature verification failed", **not** `401`. A `401` means the middleware change did not take effect.
3. Replay an event with an empty `customer_email` and an unknown `stripeCustomerId` → expect the new "no usable identifier" log and **no** press modified. Check this against a database with at least two presses.

**Then check for damage:** if `NODE_ENV` was ever not `production`, the dev fallback at `:31` parses unsigned JSON. Audit `press.plan` against Stripe's records for any press upgraded without a matching Stripe subscription.

---

### 2.2 — Make retention actually run *(audit C4)*

**Files:** `vercel.json` (does not exist), `src/middleware.ts`, `src/app/api/cron/cleanup/route.ts:22-27`

Two compounding faults. There is no `vercel.json`, so nothing is scheduled. And `/api/cron` is not in `publicRoutes`, so even a correct call is intercepted: middleware reads the `Authorization: Bearer <CRON_SECRET>` header, tries to verify it as a JWT, fails, and returns `401`. Expired `PdfJob` rows and their Cloudinary files accumulate forever despite `expiresAt` being set to 7 days.

**Fix A — schedule it.** New file `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/cleanup", "schedule": "17 3 * * *" }
  ]
}
```

**Fix B — routing:**

```diff
--- a/src/middleware.ts
   '/api/health',
+  '/api/cron',
   '/api/desktop/version',
```

The route's own `CRON_SECRET` check becomes the auth boundary — which it already is, and it correctly refuses when `CRON_SECRET` is unset.

**Fix C — constant-time comparison.** `route.ts:25` uses `!==` on a secret:

```ts
import crypto from 'crypto';

const authHeader = request.headers.get('Authorization') ?? '';
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const expected = `Bearer ${cronSecret}`;
const a = Buffer.from(authHeader);
const b = Buffer.from(expected);
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Fix D — Vercel cron sends `GET`.** The handler only exports `POST`. Either add a `GET` export that delegates, or configure the schedule accordingly — **verify which your platform sends before declaring this done.** A scheduled `GET` against a `POST`-only route returns `405` and fails silently forever, which is the exact failure mode being fixed.

**Fix E — retire the manual purge (carried over from item 0.3).** Once the scheduled job is confirmed running, delete `src/app/api/jobs/cleanup/` and remove the "Purge Expired Files" button it backs — `handleTriggerCleanup` and its `cleanupLoading` / `cleanupResult` state in `src/app/dashboard/settings/page.tsx` (caller at `:571`). Phase 0 restricted that route to OWNER rather than deleting it, precisely so this cleanup would not leave a retention gap.

> ⚠️ **Phase 5 dependency.** This route calls `prisma.pdfJob.findMany` / `deleteMany` with no tenant header, and works *only because tenant isolation currently fails open* — it sweeps all tenants, which is correct for a cron job. Item 5.3 converts it to an explicit system context. **If Phase 5 flips the default without that conversion, this job will silently purge nothing.**

**Verify:**
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/cleanup
```
→ `200` with a job count. Wrong secret → `401`. No header → `401`. Then confirm the platform's cron dashboard shows a successful run, and that `pdf_jobs` rows with `expires_at` in the past are gone the next morning.

**Also:** with retention broken since launch, there is a backlog. Check `SELECT count(*) FROM pdf_jobs WHERE expires_at < now()` and the Cloudinary storage total before the first run — the first sweep may be very large and may need to be batched.

---

# Phase 3 — Close authorization gaps (~2 days)

---

### 3.1 — Introduce a real authorization helper *(audit H2)*

**Problem:** authorization lives in a substring-matched path list in middleware (`src/middleware.ts:82-87`). It missed `/api/marketplace/purchase` and `/api/press/deduct-credits`, so a **DESIGNER — the lowest-privilege role — can drain the press's paid credit balance.** Neither route checks `x-user-role` at all; both authorize on `x-press-id` alone.

Adding those two paths to the middleware list would be a patch on a broken pattern. The routes should own their own authorization.

**New file — `src/lib/authz.ts`:**

```ts
import { NextResponse } from 'next/server';

export type Role = 'OWNER' | 'OPERATOR' | 'DESIGNER';

export interface Actor {
  userId: number;
  pressId: number;
  role: Role;
}

/** Read the middleware-injected user context. Returns null if absent or malformed. */
export function getActor(request: Request): Actor | null {
  const userId = Number(request.headers.get('x-user-id'));
  const pressId = Number(request.headers.get('x-press-id'));
  const role = request.headers.get('x-user-role') as Role | null;
  if (!Number.isInteger(userId) || !Number.isInteger(pressId) || !role) return null;
  return { userId, pressId, role };
}

/**
 * Guard a route. Returns { actor } on success, or { response } to return directly.
 *
 *   const { actor, response } = requireRole(request, ['OWNER']);
 *   if (response) return response;
 */
export function requireRole(
  request: Request,
  allowed: readonly Role[],
): { actor: Actor; response: null } | { actor: null; response: NextResponse } {
  const actor = getActor(request);
  if (!actor) {
    return { actor: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!allowed.includes(actor.role)) {
    return { actor: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { actor, response: null };
}
```

This is also the single place where item 5.4 will fold in signature verification, so every route gains it at once.

**Apply to the two money routes:**

```diff
--- a/src/app/api/press/deduct-credits/route.ts
-    const pressIdStr = request.headers.get('x-press-id');
-    const userIdStr = request.headers.get('x-user-id');
-    if (!pressIdStr || !userIdStr) {
-      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
-    }
-    const pressId = Number(pressIdStr);
+    const { actor, response } = requireRole(request, ['OWNER', 'OPERATOR']);
+    if (response) return response;
+    const pressId = actor.pressId;
```

Same in `src/app/api/marketplace/purchase/route.ts`.

**Then sweep the rest.** Every route that reads `x-press-id` directly should move to `getActor`/`requireRole`, and every mutating route needs a deliberate answer to "which roles may call this?". `src/app/api/jobs/route.ts` already gets this right and is the reference.

**Verify:** a role-matrix test. For each of OWNER / OPERATOR / DESIGNER, call every mutating route and assert the expected status. This is the first real integration test and should be kept.

---

### 3.2 — Derive the credit amount server-side *(audit H3)*

**File:** `src/app/api/press/deduct-credits/route.ts:13-17`

```ts
const { amount, reason } = await request.json();
```

The client decides how much to charge itself. A modified or buggy desktop client can under-report indefinitely. The transaction itself is correct — `SELECT ... FOR UPDATE`, promo credits consumed before paid — but it is locking the right row to apply the wrong number.

**The schema already solves this.** `PdfJob` has `creditsLocked`, `creditsUsed`, and `rateApplied` (`prisma/schema.prisma:311-313`). The amount is already computed and stored server-side when the job is created. **No migration is needed.**

**Fix — take a `jobId`, not an `amount`:**

```ts
const { jobId } = await request.json();
if (!Number.isInteger(jobId)) {
  return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
}

const updated = await prisma.$transaction(async (tx) => {
  // Lock the job first, then the press — consistent order avoids deadlock.
  const jobs = await tx.$queryRaw<any[]>`
    SELECT id, credits_locked, credits_used, press_id
    FROM "pdf_jobs" WHERE id = ${jobId} AND press_id = ${pressId} FOR UPDATE
  `;
  const job = jobs[0];
  if (!job) throw new Error('JOB_NOT_FOUND');

  // Idempotency: a retried request must not double-charge.
  if (Number(job.credits_used) > 0) return { alreadyCharged: true };

  const amount = Number(job.credits_locked);
  if (amount <= 0) throw new Error('NOTHING_TO_CHARGE');

  const presses = await tx.$queryRaw<any[]>`
    SELECT id, credits, promo_credits FROM "press" WHERE id = ${pressId} FOR UPDATE
  `;
  const press = presses[0];
  if (!press) throw new Error('PRESS_NOT_FOUND');

  const paid = Number(press.credits || 0);
  const promo = Number(press.promo_credits || 0);
  if (paid + promo < amount) throw new Error('INSUFFICIENT_CREDITS');

  const promoDeduct = Math.min(promo, amount);
  const paidDeduct = amount - promoDeduct;

  await tx.pdfJob.update({ where: { id: jobId }, data: { creditsUsed: amount } });

  return tx.press.update({
    where: { id: pressId },
    data: {
      ...(promoDeduct > 0 ? { promoCredits: { decrement: promoDeduct } } : {}),
      ...(paidDeduct > 0 ? { credits: { decrement: paidDeduct } } : {}),
    },
  });
});
```

Note the `AND press_id = ${pressId}` in the job lock — raw SQL bypasses the Prisma tenant extension, so the tenant filter must be written by hand. This is exactly the class of bug Phase 5 is about.

**Also fix the error handling** (`:54-57`): the catch returns `400` for everything, including genuine `500`s, and logs the raw error. Map the thrown codes to statuses — `404` for `JOB_NOT_FOUND`, `402` for `INSUFFICIENT_CREDITS`, `500` for anything unrecognised.

**Coordinate with the desktop client.** It currently sends `{ amount }`. Either ship both shapes for one release, or release the two together. **Do not deploy this without checking what `desktop-client/` sends** — the audit did not cover that directory.

**Verify:** replay the same `jobId` twice → second call is a no-op, balance decrements once. Send a `jobId` belonging to another press → `404`.

---

# Phase 4 — Dependencies & infrastructure (~2 days)

---

### 4.1 — Upgrade vulnerable dependencies *(audit C5)*

`npm audit --omit=dev` → 9 vulnerabilities (1 critical, 6 high, 2 moderate).

| Package | Current | Action |
|---|---|---|
| `next` | 16.2.7 | → ≥ 16.2.11 (npm suggests 16.3.4) |
| `sharp` | ^0.34.5 | → ≥ 0.35.4 |
| `adm-zip` | ^0.5.17 | → ≥ 0.6.0 |
| `postcss`, `uuid`/`exceljs`, `deepmerge-ts`/`prisma` | transitive | `npm audit fix` |

`sharp` is the urgent one in context: it is invoked on **untrusted user uploads** at `src/app/api/upload/route.ts:75,87,247` and on the portal path. The advisories are libvips/libheif memory-safety bugs reachable by a crafted image.

**On the `next` upgrade — one correction worth carrying forward:** the critical advisory GHSA-6gpp-xcg3-4w24 / CVE-2026-64642 (middleware bypass) requires App Router **and** Turbopack **and** a `config.i18n.locales` array with exactly one entry. This app configures no `i18n`, so **that specific bypass does not apply here.** Do not treat the upgrade as an emergency on those grounds. The other advisories in the range — AVIF image-optimization RCE, SVG DoS, cache confusion, SSRF via rewrites, Server Function disclosure — do apply, so still upgrade, but schedule it as a normal change with a full regression pass rather than a hotfix.

**Verify:** `npm audit --omit=dev` clean at `--audit-level=high`; `npx tsc --noEmit`, `npx vitest run`, `npx next build` all pass; then manually exercise image upload, PDF analysis, Excel import, and ZIP export — the four paths through the upgraded libraries.

---

### 4.2 — Provision Upstash and extend rate-limit coverage *(audit H4)*

**File:** `src/lib/rate-limit.ts:23-35`

No `UPSTASH_*` variables are set, so the module-level `Map` fallback is active. On serverless each instance holds its own `Map`, making the effective limit `configured × instance_count`. The code already logs `[CRITICAL]` about this in production — it is telling you it is not working.

**Fix A:** provision Upstash Redis, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. No code change — the module picks them up.

**Fix B — trust the platform's client IP.** `getClientIp` (`:126-133`) takes the first value of `x-forwarded-for`, which the client controls unless a proxy unconditionally overwrites it. On Vercel, prefer `x-vercel-forwarded-for`; behind another proxy, use whichever header that proxy is known to set, and document it.

**Fix C — cover the write paths that have none.** Most importantly `src/app/api/portal/upload/route.ts` — it accepts unauthenticated 5MB uploads (only a portal token is needed) and forwards them to your Cloudinary account. There is no rate limit at all.

**Fix D — verify uploaded content by bytes, not by the client's word.** `portal/upload/route.ts:71-74` checks `file.type`, which is the client-supplied part header:

```ts
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
if (!ALLOWED_MIME_TYPES.includes(file.type)) { ... }
```

Sniff the magic bytes of the buffer instead, and pass an explicit `resource_type: 'image'` to Cloudinary rather than `'auto'` (`:85`).

The same applies to `src/app/api/upload/route.ts`, which validates by **file extension only** — `src/app/api/superadmin/upload/route.ts` already checks both and is the in-repo reference.

**Verify:** exceed the limit from two different instances and confirm the counter is shared. Upload a `.png` whose bytes are a PDF → rejected.

---

### 4.3 — Make `/api/health` able to report unhealthy *(audit M5)*

**File:** `src/app/api/health/route.ts:20-26`

Returns **HTTP 200 with `status: 'degraded'` when the database is down.** The comment explains the intent — the Electron client wants to know the server is reachable — but the consequence is that no load balancer, uptime monitor, or platform health check will ever mark this application unhealthy.

**Fix — split the two questions:**

```ts
// /api/health — for monitors. Status code carries the verdict.
export async function GET() {
  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'connected' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Health check: database unreachable');
    return NextResponse.json({ status: 'unhealthy', database: 'disconnected' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
```

Add `/api/health/reachable` returning a bare `200` for the desktop client, and point the client at it.

Also drop `uptime: process.uptime()` (needless disclosure) and narrow `Access-Control-Allow-Origin: '*'` (`:7`) to the desktop client's origin on whichever endpoint it uses.

**Verify:** stop the database, `curl -i /api/health` → `503`; `/api/health/reachable` → `200`.

---

# Phase 5 — Tenant isolation fails closed (~5–8 days)

The largest change in this plan. Do not attempt it in one pass.

---

### 5.1 — The problem *(audit H1)*

**File:** `src/lib/prisma.ts:17-27, 208`

```ts
async function getCurrentPressId(): Promise<number | null> {
  try {
    const headersList = await headers();
    const pressIdStr = headersList.get('x-press-id');
    return pressIdStr ? Number(pressIdStr) : null;
  } catch {
    return null;   // outside a request context
  }
}
```

and then:

```ts
if (tenantModels.includes(model) && pressId !== null) {
```

When `pressId` is `null` the entire isolation block is skipped — **no tenant filter is applied at all**. The failure mode is "see everything", not "see nothing".

**Being precise about the risk:** I could not construct a working cross-tenant exploit. Middleware uses `Headers.set()`, which overwrites any client-supplied `x-press-id` on protected routes. On the public routes where a client *can* forge the header, the forged value also scopes the lookup that authorizes the request — `clientPortalShare.findUnique({ orgToken })` becomes `findFirst({ orgToken, pressId: forged })` — so forgery produces a 404, not a leak. **This is a latent design risk, not a known live vulnerability.** It is ranked here because the cost of being wrong is every tenant's data, and because one forgotten `.some()` in `publicRoutes` or one route excluded from the matcher converts it into a breach with no second line of defence.

---

### 5.2 — Add an explicit context, warn-only *(2 days)*

Do **not** flip the default yet. First find every caller that relies on the current behaviour.

```ts
import { AsyncLocalStorage } from 'async_hooks';

type Ctx = { pressId: number } | { system: true };
const ctxStore = new AsyncLocalStorage<Ctx>();

/** Run with an explicit tenant — for token-authenticated routes (portal, v1). */
export function withPressContext<T>(pressId: number, fn: () => Promise<T>) {
  return ctxStore.run({ pressId }, fn);
}

/** Run unscoped, deliberately — cron, superadmin, marketplace, seed. */
export function withSystemContext<T>(fn: () => Promise<T>) {
  return ctxStore.run({ system: true }, fn);
}

async function resolveContext(): Promise<Ctx | null> {
  const explicit = ctxStore.getStore();
  if (explicit) return explicit;
  try {
    const h = await headers();
    const raw = h.get('x-press-id');
    if (raw) {
      const n = Number(raw);
      if (Number.isInteger(n)) return { pressId: n };
    }
  } catch { /* outside a request context */ }
  return null;
}
```

In the extension, replace the `pressId !== null` guard with:

```ts
const ctx = await resolveContext();

if (tenantModels.includes(model)) {
  if (ctx === null) {
    // PHASE 5.2: warn only. Phase 5.4 turns this into a throw.
    console.error('[TENANT] unscoped query on tenant model', {
      model, operation: op, stack: new Error().stack,
    });
  } else if ('pressId' in ctx) {
    // ... existing rewriting logic, using ctx.pressId
  }
  // ctx.system → deliberately unscoped, no filter
}
```

`AsyncLocalStorage` is Node-only. That is fine — `src/lib/prisma.ts` is never imported by edge middleware (`src/middleware.ts` imports only `./lib/auth-edge`). Confirm that stays true.

**Deploy this and leave it for a week.** The logs become the migration checklist.

---

### 5.3 — Migrate every caller the logs identify (~3–4 days)

Expect roughly 40 routes. Known categories:

| Caller | Fix |
|---|---|
| `/api/portal/*` | `withPressContext(share.pressId, ...)` after resolving the token. **Strictly better isolation than today** — currently these run unscoped. |
| `/api/v1/*` | `withPressContext(apiKey.pressId, ...)` after resolving the key. |
| `/api/superadmin/*` | `withSystemContext(...)` — cross-tenant by definition. |
| **`/api/cron/cleanup`** | **`withSystemContext(...)`. See the warning at item 2.2 — miss this and nightly cleanup silently stops.** |
| `/api/press/login`, `/api/press/signup`, `/api/public/client-signup` | `withSystemContext(...)` — no tenant exists yet at that point. |
| `/api/desktop/*` | Depends on how it authenticates; audit separately. |
| `prisma/seed.ts` | `withSystemContext(...)`. |
| Marketplace | Already partly on `basePrisma`; make it consistent. |

Note the portal and v1 migrations are genuine **security improvements**, not just compatibility work — they convert unscoped queries into explicitly scoped ones.

**Also sweep raw SQL.** `$queryRaw` bypasses the extension entirely and must carry its own `press_id` predicate — see the note in item 3.2. Grep for `$queryRaw` and check each one.

---

### 5.4 — Flip the default, and revive the dead HMAC (~1 day)

Once the warning has been silent in production for seven days:

```ts
if (ctx === null) {
  throw new Error(`Tenant context required for ${model}.${op}`);
}
```

**And close the dead-code finding in the same change.** `src/lib/middleware-verify.ts` exports `verifyMiddlewareHeaders`, documented as the defense-in-depth check — and **not one of the 96 routes imports it**. Meanwhile middleware computes an HMAC on *every authenticated request* (`src/middleware.ts:117-134`) that nothing ever verifies. The protection the codebase believes it has does not exist, and every request pays for it.

Because Phase 3 routed all header reads through `getActor`, there is now exactly one place to fix:

```diff
--- a/src/lib/authz.ts
 export function getActor(request: Request): Actor | null {
+  if (!verifyMiddlewareHeaders(request)) return null;
   const userId = Number(request.headers.get('x-user-id'));
```

Every route gains verification at once.

**If you decide not to do this,** delete `src/lib/middleware-verify.ts` *and* the HMAC block in middleware. Keeping an unverified signature is worse than having none: it costs a `crypto.subtle` import and sign per request and creates a false belief in a control that is not there. Choose one.

Note both the middleware and the verifier default to `process.env.JWT_SECRET || 'dev-middleware-secret'`. `src/lib/config.ts` already enforces a real `JWT_SECRET` in production, so the fallback should be removed rather than relied on.

**Verify:** the full role matrix from item 3.1, plus the portal, v1, superadmin, cron, and signup flows end to end. This phase touches everything; budget for a full regression pass.

---

# Phase 6 — Data integrity (~3 days)

---

### 6.1 — Bulk import silently skips the double-write *(audit M1)*

**Files:** `src/lib/prisma.ts:279-290`, `src/app/api/cardholders/import/route.ts:320`

The post-write sync runs only `if (item && item.id)`. `createMany` returns `{ count }` with no ids, and the import route uses `createMany` — so cardholders created individually get `CardholderValue` rows and bulk-imported ones never do. Two classes of record with different shapes, silently.

**Fix — prefer the narrow one:** in the import route, replace `createMany` with a batched `create` loop inside a transaction (chunks of ~100), which triggers the sync correctly. The alternative — teaching the extension to re-query after `createMany` — adds a full table scan to every bulk insert to work around an ordering problem, and is worse.

**Then backfill:** find cardholders with no `CardholderValue` rows and run `syncCardholderValues` over them. Every historical import is affected.

```sql
SELECT c.id FROM cardholders c
LEFT JOIN cardholder_values v ON v.cardholder_id = c.id
WHERE v.id IS NULL AND c.deleted_at IS NULL;
```

---

### 6.2 — `findUnique` drops the global-template allowance *(audit M2)*

**File:** `src/lib/prisma.ts:211-216` vs `:221-234`

Branch 1a hard-sets `args.where[pressIdField] = pressId`. Branch 1b, for `CardTemplate`, wraps the filter in `OR: [{ pressId: null }, { pressId }]` to allow platform-global templates (`CardTemplate.pressId` is nullable — `schema.prisma:124`).

So a global template is visible in list views and **invisible to any detail lookup**.

**Fix — make 1a use the same predicate:**

```ts
if (['findUnique', 'findUniqueOrThrow'].includes(op)) {
  args.where = args.where || {};
  if (model === 'CardTemplate') {
    args.where = { AND: [args.where, { OR: [{ pressId: null }, { pressId }] }] };
  } else {
    args.where[pressIdField] = pressId;
  }
  const rewrittenOp = op === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
  return (basePrisma as any)[model][rewrittenOp](args);
}
```

Better: extract the shared predicate into one function used by both branches, so they cannot drift again.

---

### 6.3 — Cap pagination and input size *(audit M4)*

| File | Problem | Fix |
|---|---|---|
| `src/app/api/jobs/route.ts` (GET) | `take: Number(limit) \|\| 50`, uncapped, with `include: { order: { invoice, cardholders } }` | `Math.min(Math.max(1, n \|\| 50), 100)` |
| `src/app/api/portal/org/[orgToken]/cardholders/route.ts` | `Number(limit)` → `NaN` → Prisma throws `500` | same clamp, `NaN`-safe |
| `src/app/api/cardholders/import/route.ts` | no row cap on Papa.parse / ExcelJS | reject > 5,000 rows with a clear message |
| `src/app/api/templates/analyze-pdf/route.ts` | no size cap | done in item 0.2 |

Put the clamp in one shared helper rather than repeating it.

---

### 6.4 — Fix the serial-number race *(audit L9)*

**File:** `src/lib/serials.ts`

The comment claims *"Uses a transactional increment ... to prevent race conditions"*. The `{ increment: 1 }` is atomic and safe — but the **find-or-create before it has no lock**. Two concurrent first-uses of a prefix both miss, both insert, one gets a `P2002` and a `500`.

`CardSerialCounter` already has `@@unique([pressId, clientId, prefix])` (`schema.prisma:371`), so an upsert on that compound key is the direct fix:

```ts
const counter = await tx.cardSerialCounter.upsert({
  where: { pressId_clientId_prefix: { pressId, clientId, prefix } },
  create: { pressId, clientId, prefix, lastSeq: 1, padLen },
  update: { lastSeq: { increment: 1 } },
});
```

Correct the misleading comment while you are there.

---

### 6.5 — Constrain `cardSerial` *(audit L8)*

**File:** `prisma/schema.prisma:101`

`Cardholder.cardSerial` has no unique constraint, while the portal generates `C-${Date.now()}-${Math.floor(Math.random()*1000)}` — collidable, with nothing at the database level to catch it.

```prisma
@@unique([pressId, cardSerial])
```

**Check for existing duplicates before migrating**, or the migration will fail:

```sql
SELECT press_id, card_serial, count(*) FROM cardholders
WHERE card_serial IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1;
```

Postgres treats `NULL`s as distinct, so nullable serials are unaffected. Then move portal generation onto `assignSerialNumber` so there is one serial source, not two.

---

### 6.6 — Scope user email to the press *(audit L10)*

**File:** `prisma/schema.prisma:53`

`PressUser.email String @unique` is **globally** unique, so one person cannot hold accounts at two presses. For a multi-tenant SaaS this is very likely unintended.

```diff
-  email        String   @unique
+  email        String
+  @@unique([pressId, email])
```

**This changes the login flow** — `src/app/api/press/login/route.ts` looks up by email alone and will need a press discriminator (subdomain, an explicit press field, or resolving to a chooser when an email matches several). Do not migrate the schema without doing that at the same time. `Press.email` (`:16`) can stay globally unique.

Confirm the product intent before doing this one; if single-press-per-person is deliberate, close it as won't-fix and record why.

---

# Phase 7 — Hygiene & debt (ongoing)

---

### 7.1 — Burn down 876 lint errors *(audit L2)*

Mostly `@typescript-eslint/no-explicit-any`. Ratchet rather than boil the ocean: fix `src/lib/` and `src/app/api/` first, then flip CI's `|| true` (item 1.3) to enforcing so no new errors land.

### 7.2 — Test the real code, not a copy *(audit M8)*

`tests/unit/tenant-isolation.test.ts` is candid: *"we replicate the extension's argument-rewriting logic … This is a faithful copy of the logic at src/lib/prisma.ts lines 189–260."* It imports only vitest. The 21 tenant-isolation tests will keep passing after `src/lib/prisma.ts` regresses.

Rewrite them to import the real extension against a test database (or a mocked `$allOperations`), and add the role-matrix integration test from item 3.1. The Phase 5 work is not safely verifiable without this — consider pulling it forward to sit alongside Phase 5.

### 7.3 — `middleware` → `proxy` *(audit L4)*

Next 16 deprecates the `middleware` file convention; the build warns. **The entire authorization model lives in this file** — do it deliberately, with the role matrix green, not under time pressure when the convention is finally removed. Read `node_modules/next/dist/docs/` for the current guidance before starting, per `AGENTS.md`.

### 7.4 — Add a CSP *(audit L6)*

`next.config.ts` sets HSTS, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy. CSP is the gap, and the app accepts SVG uploads. Start report-only, then enforce.

### 7.5 — Make superadmin deletion safe *(audit M6)*

`src/app/api/superadmin/presses/[id]/route.ts` destroys Cloudinary media **before** opening the DB transaction (fail there and media is gone while rows remain), loads every cardholder unpaginated, and issues one sequential `destroy()` per cardholder — guaranteeing a timeout on a large press and a half-finished deletion.

Invert it: transaction first, then queue media deletion as background work. Add a dry-run that reports what would be deleted.

### 7.6 — Real audit coverage and real IPs *(audit M7)*

Only 7 of 96 routes write to `SystemAuditLog`, and several superadmin routes hardcode `ipAddress: '127.0.0.1'` — including the `severity: 'CRITICAL'` hard-delete. That puts fabricated data in the record you would rely on during an incident.

`SystemAuditLog.ipAddress` is non-null (`schema.prisma:566`), which is probably why someone reached for a placeholder. Make it nullable and pass the real value from the request, or `'unknown'` — never a fake one. Then extend coverage to every mutating route, ideally through the `authz` helper from item 3.1.

### 7.7 — Move business config out of code *(audit L7)*

`pricePerCard = 50.0` and `taxPercent = 18.0` are hardcoded in `src/app/api/jobs/route.ts`. A GST change requires a redeploy. `SystemSetting` (`schema.prisma:578`) already exists for exactly this.

### 7.8 — Repo cleanup *(audit L13)*

Remove `dev.log`, `scratch/`, `artifacts/`, `model_photos/`, `.stitch/`, the ~2.4MB of root PDFs and the 467KB `tsconfig.tsbuildinfo`; add them to `.gitignore`. Delete the stale `audit.md` and `plan.md`, and the stray non-migration `prisma/migrations/manual_add_audit_log.sql` — it is harmless (the table *is* created by migration `20260709133252_add_revenue_tracking_to_pdf_job`) but it reads like schema drift and will mislead the next person.

### 7.9 — Sentry deprecation *(audit L5)*

Replace `disableLogger` with `webpack.treeshake.removeDebugLogging`.

---

## Verification checklist before launch

Phases 0–4 complete, and each of these confirmed by hand against a deployed environment — not inferred from code:

- [ ] `GET /api/test-db` → 404
- [ ] `analyze-pdf` rejects traversal, non-https, and non-allowlisted hosts; **still analyses a real Cloudinary template**
- [ ] `POST /api/jobs/cleanup` → 404
- [ ] Stripe CLI event → 200 and a real plan change; bad signature → 400 (not 401)
- [ ] Cron fires on schedule, purges expired jobs, and rejects a wrong secret
- [ ] DESIGNER → 403 on `marketplace/purchase` and `deduct-credits`; OWNER → 200
- [ ] Credit deduction is idempotent per `jobId` and ignores any client-sent amount
- [ ] `npm audit --omit=dev --audit-level=high` clean
- [ ] Rate limit shared across instances (Upstash reachable)
- [ ] `/api/health` → 503 with the database stopped
- [ ] CI green on a pull request

---

## What this plan does not cover

Carried forward from the audit's stated limits, so it is not mistaken for completeness:

- **`desktop-client/`** was not audited. It is excluded from `tsconfig.json`, holds a long-lived credential, and drives the credit path that item 3.2 changes. It needs its own review, and item 3.2 needs its cooperation.
- **The frontend** (~57k lines) was not reviewed for XSS or client-side authorization leakage.
- **No load testing.** Items 6.3 and the `syncCardholderValues` round-trip cost (audit M3) are reasoned from code shape, not measured.
- **Production environment variables** could not be inspected. Whether Upstash, Stripe, and `CRON_SECRET` are actually set in the deployment target determines the real severity of items 2.2 and 4.2 — check them first.
