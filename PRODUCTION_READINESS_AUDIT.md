# Production Readiness Audit

**Project:** student-id-pdf-system
**Date:** 2026-09-09
**Commit:** `a80c8f1` (working tree has 113 uncommitted modified files)
**Auditor:** Independent review — no prior claims, docs, or the existing `audit.md` were trusted. Every finding below was verified against source or by running a command.

---

## Verdict

**Not production ready.** The application builds cleanly, typechecks with zero errors, and passes its 80 unit tests. The multi-tenant isolation layer and the credit/billing concurrency handling are better engineered than most codebases of this size. But there are **four issues that must be fixed before launch**, two of which mean advertised features silently do not work at all in production, and one of which is a server-side request forgery / arbitrary file read reachable by the lowest-privilege user role.

| Area | State |
|---|---|
| Build / typecheck | ✅ Clean (`next build` exit 0, `tsc --noEmit` exit 0) |
| Unit tests | ⚠️ 80 pass, but they test *copies* of the logic, not the logic |
| Integration tests | ❌ None across 96 API routes |
| CI | ❌ None (`.github/workflows` does not exist) |
| Authn / authz | ⚠️ Sound design, but fail-open and with dead defense-in-depth |
| Tenant isolation | ⚠️ Works; fails open rather than closed |
| Secrets handling | ✅ `.env` untracked, JWT entropy guard enforced |
| Dependencies | ❌ 9 vulns in prod deps (1 critical, 6 high) |
| Payments | ❌ Stripe webhook is unreachable — silently dead |
| Data retention | ❌ Cleanup never runs — unbounded storage growth |
| Observability | ⚠️ Sentry wired; health check cannot report unhealthy |

---

## Method

What was actually executed, not inferred:

```
npx next build            → exit 0 (Next.js 16.2.7, Turbopack)
npx tsc --noEmit          → exit 0
npx vitest run            → 7 files, 80 tests, all pass
npx eslint                → 1147 problems (876 errors, 271 warnings)
npm audit --omit=dev      → 9 vulnerabilities (1 critical, 6 high, 2 moderate)
```

Plus a route-by-route sweep of all 96 `route.ts` files for authentication signals, manual reading of the middleware, the Prisma tenant-isolation extension, both auth libraries, and every route flagged by the sweep as unauthenticated or credit-touching.

`npm run build` was **not** run, because its script executes `prisma migrate deploy` against the live `DATABASE_URL`. `next build` was invoked directly instead.

---

## Critical — fix before launch

### C1. SSRF and arbitrary local file read via `/api/templates/analyze-pdf`

`src/app/api/templates/analyze-pdf/route.ts` accepts an attacker-controlled `originalUrl` from the request body and passes it straight to `getPdfBuffer`:

```ts
async function getPdfBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('/')) {
    const localPath = path.join(process.cwd(), 'public', url);
    if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
    throw new Error(`Local file not found: ${localPath}`);
  }
  if (url.startsWith('http')) {
    const res = await fetch(url);           // ← no allowlist, no timeout, no size cap
    ...
  }
}
```

Three distinct problems in nine lines:

1. **SSRF.** `fetch(url)` will retrieve any `http(s)` URL the server can reach — cloud instance metadata (`169.254.169.254`), internal services, private RFC1918 ranges. Redirects are followed.
2. **Path traversal / arbitrary file read.** `path.join(cwd, 'public', '/../../etc/passwd')` resolves *outside* `public/`. `fs.readFileSync` then reads it. Any PDF-parseable file on the host is returned as extracted field data.
3. **Path disclosure / existence oracle.** The error message echoes the fully resolved `localPath` back to the caller, so the endpoint confirms whether any given path exists.

There is no file-size cap and no timeout, so it doubles as a memory-exhaustion vector.

**Reachable by:** any authenticated user, **including the `DESIGNER` role** — the middleware's designer blocklist covers `/api/orders|billing|invoices|clients|cardholders`, not `/api/templates`.

**Fix:** allowlist the host (Cloudinary only), reject non-public IP literals after DNS resolution, resolve the local path and verify it is still inside `public/`, add a byte cap and an `AbortSignal.timeout`, and return a generic error rather than the resolved path.

---

### C2. `/api/test-db` is an unauthenticated database introspection endpoint

`src/middleware.ts` lists `/api/test-db` in `publicRoutes`, so it bypasses authentication entirely. The handler returns:

- the full `information_schema` table listing for the `public` schema,
- `pressUser` and `press` row counts,
- up to 50 rows of `card_templates` joined to press names, including `price` and `is_public`.

This is a debugging endpoint that shipped. Anyone on the internet can enumerate your schema and your tenant list.

**Fix:** delete the route and remove it from `publicRoutes`.

---

### C3. Stripe webhooks can never be delivered — the paid-plan path is dead

`/api/billing/stripe-webhook` is **not** in `publicRoutes`. Middleware therefore falls through to the press-user branch, which requires a `press_auth_token` cookie or a JWT `Bearer` header:

```ts
if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
  let token = request.cookies.get('press_auth_token')?.value;
  ...
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

Stripe sends neither. Every webhook gets a **401 before the handler ever runs**. The signature verification inside the route is implemented correctly and is unreachable.

Consequence: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated` and `customer.subscription.deleted` are all silently dropped. Customers pay and are never upgraded; cancellations never downgrade.

**Related latent bug** in the same handler, which will surface the moment the route is reachable — `handleUpgrade` matches a press by:

```ts
OR: [{ stripeCustomerId }, { email: customerEmail || undefined }]
```

When `customerEmail` is empty, Prisma drops the `undefined` field, leaving `{}` in the `OR`, which matches **every row**. `findFirst` then upgrades an arbitrary press. Guard the branch instead of relying on `|| undefined`.

**Fix:** add `/api/billing/stripe-webhook` to `publicRoutes` (the route's own signature check is the correct auth boundary), and fix the `OR` clause.

---

### C4. Data retention never runs — unbounded storage growth

Two compounding faults:

1. **No scheduler exists.** There is no `vercel.json`, so no cron job is registered. Nothing ever calls the cleanup endpoint.
2. **Even if it were called, it would be rejected.** `/api/cron/cleanup` correctly validates `Authorization: Bearer ${CRON_SECRET}`, but `/api/cron` is not in `publicRoutes`. Middleware intercepts first, extracts the bearer token, tries to verify it as a JWT, fails, and returns 401.

So expired `PdfJob` rows and their Cloudinary files accumulate forever, despite `expiresAt` being set to 7 days on every job.

The irony worth noting: the *unprotected* near-duplicate at `/api/jobs/cleanup` — whose own comment reads *"In this basic version, we allow running it via post request"* — **is** reachable, by any authenticated user of any role. It is tenant-scoped by the Prisma extension, so it only deletes the caller's own expired jobs, which caps the blast radius, but it has no role check and no business being a public-facing endpoint.

**Fix:** add `vercel.json` with a cron schedule, add `/api/cron` to `publicRoutes`, and delete `/api/jobs/cleanup`.

---

### C5. Nine vulnerabilities in production dependencies

```
next    16.2.7            CRITICAL  Image Optimization AVIF RCE (GHSA-2xp9-vwfh-vxw4),
                                    SVG DoS, cache confusion, SSRF via rewrites,
                                    unauthenticated Server Function disclosure
sharp   <=0.35.4-rc.0     HIGH      libvips CVE-2026-33327/33328/35590/35591, libheif
adm-zip *                 HIGH      4GB alloc from crafted ZIP; symlink arbitrary overwrite
postcss                   MODERATE  arbitrary .map file read via sourceMappingURL
uuid / exceljs            MODERATE  buffer bounds check
```

`sharp` matters most in context: it is invoked on **untrusted user-uploaded images** at `src/app/api/upload/route.ts:75,87,247` and in the portal upload path.

**One correction to a claim you may see elsewhere:** the critical `next` advisory GHSA-6gpp-xcg3-4w24 (middleware/proxy bypass, CVE-2026-64642) requires *all three* of App Router, Turbopack, **and** a `config.i18n.locales` array with exactly one entry. This app configures no `i18n` at all, so **that specific bypass does not apply here**. The rest of the advisories in the affected range do. Upgrade `next` to ≥ 16.2.11 (npm suggests 16.3.4).

---

## High

### H1. Tenant isolation fails open, and its defense-in-depth is dead code

`src/lib/prisma.ts` enforces multi-tenancy through a Prisma `$extends` query hook that reads the tenant from a request header:

```ts
async function getCurrentPressId(): Promise<number | null> {
  try {
    const headersList = await headers();
    return headersList.get('x-press-id') ? Number(...) : null;
  } catch {
    return null;   // ← any failure ⇒ no tenant filter at all
  }
}
```

When this returns `null`, the entire isolation block is skipped and queries run **unscoped across all tenants**. The failure mode is "see everything", not "see nothing".

In practice this is much less exploitable than it first appears, and I verified why: middleware uses `Headers.set()`, which *overwrites* any client-supplied `x-press-id` on protected routes. On the public routes where a client *can* forge the header, the forged value is also applied to the lookup that authorizes the request (e.g. `clientPortalShare.findUnique({ orgToken })` becomes `findFirst({ orgToken, pressId: forged })`), so forgery is self-defeating — it causes a 404, not a cross-tenant read. I could not construct a working cross-tenant exploit.

What makes this High rather than Medium is the second half:

**`verifyMiddlewareHeaders` is never called.** `src/lib/middleware-verify.ts` exists, is documented as the defense-in-depth check, and **not one of the 96 routes imports it**. Middleware computes an HMAC signature (`x-middleware-sig`) with a Web Crypto key import and sign on *every authenticated request*, and nothing ever verifies it. The protection the codebase believes it has does not exist, and every request pays for it.

**Fix:** invert the default — treat `null` as "deny" for tenant models rather than "no filter", with an explicit opt-out for the legitimate cross-tenant paths (which already use `basePrisma`). Then either wire `verifyMiddlewareHeaders` into the routes or delete it and the middleware HMAC along with it.

### H2. The `DESIGNER` role can spend the press's credits

Middleware restricts designers to a hardcoded path list:

```ts
if (isApiCall && isPostOrPut &&
  (pathname.includes('/api/orders')  || pathname.includes('/api/billing') ||
   pathname.includes('/api/invoices') || pathname.includes('/api/clients') ||
   pathname.includes('/api/cardholders')))
```

Not covered: `/api/marketplace/purchase` and `/api/press/deduct-credits`. Neither performs a role check of its own — both authorize on `x-press-id` alone. A `DESIGNER`, the lowest-privilege role, can drain the press's paid credit balance by buying marketplace templates.

`/api/jobs` does correctly reject `DESIGNER`, which shows the intent; the marketplace routes were simply missed.

Separately, `isPostOrPut` tests `POST | PUT | DELETE` and **omits `PATCH`**. No currently-exploitable route sits behind that gap, but it will silently admit the next `PATCH` handler added under those paths.

**Fix:** enforce roles in the routes that mutate money, not in a path-prefix list in middleware.

### H3. Credit deduction is client-directed

`/api/press/deduct-credits` accepts `{ amount }` from the caller and decrements that many credits. The transaction itself is correct — it takes a `SELECT … FOR UPDATE` row lock and splits promo vs. paid credits properly — but *how much to charge is decided by the client*, with no link to any job, order, or card count the server can verify. A modified or buggy desktop client can under-report indefinitely.

**Fix:** derive the amount server-side from the completed job.

### H4. Rate limiting is ineffective as deployed

`src/lib/rate-limit.ts` uses Upstash Redis when configured and otherwise falls back to a module-level `Map`. The local `.env` sets no `UPSTASH_*` variables, so the fallback is active — and on serverless, each instance holds its own `Map`, so the effective limit is `configured_limit × instance_count`. The code logs `[CRITICAL]` about this in production, correctly.

`getClientIp` also trusts the first value of `X-Forwarded-For`, which is client-controlled unless a trusted proxy unconditionally overwrites it.

Coverage is thin regardless: of 96 routes, only login, signup, superadmin login, upload, photo import, portal enroll and client-signup are limited. Notably **`/api/portal/upload` has none** — it accepts unauthenticated 5MB uploads (only a shareable portal URL token is needed) and forwards them to your Cloudinary account with `resource_type: 'auto'`. Its MIME check reads `file.type`, the client-supplied part header, with no magic-byte verification.

**Fix:** provision Upstash before launch, rate-limit the portal write paths, and sniff content type from bytes.

---

## Medium

### M1. Bulk import silently skips the `CardholderValue` double-write

The extension's post-write sync runs only when the result carries an `id`:

```ts
if (model === 'Cardholder' && ['create','update','upsert'].includes(op) && result) {
  for (const item of items) { if (item && item.id) await syncCardholderValues(item.id); }
}
```

`createMany` returns `{ count }` with no ids — and `src/app/api/cardholders/import/route.ts:320` uses `createMany`. So cardholders created one at a time get `CardholderValue` rows and bulk-imported ones never do. Two classes of record with different shapes, silently.

### M2. `findUnique` on `CardTemplate` loses the global-template allowance

The extension has two branches with different semantics for the same model:

- `findUnique` / `findUniqueOrThrow` → `where.pressId = pressId` (exact match)
- `findFirst` / `findMany` / `count` / … → `AND[ where, OR[{pressId: null}, {pressId}] ]` (allows platform-global templates)

So a global template (`pressId: null`) is visible in list views and invisible to any detail lookup. Make branch 1a use the same `OR`.

### M3. The double-write is O(fields) sequential round-trips per record

`syncCardholderValues` performs one `findUnique`, N `upsert`s, one `findMany`, and M `delete`s — serially — for every single cardholder create or update. On a per-record import path this multiplies database round-trips by the field count.

### M4. No caps on pagination or input size

- `GET /api/jobs` — `take: Number(limit) || 50`, uncapped, with `include: { order: { invoice, cardholders } }`. `?limit=999999` returns the entire nested object graph.
- `GET /api/portal/org/[orgToken]/cardholders` — `Number(limit)` passed straight to `take`; `?limit=abc` yields `take: NaN`, which Prisma rejects with a 500.
- `/api/cardholders/import` — no row cap; the whole CSV/XLSX is parsed into memory.
- `/api/templates/analyze-pdf` — no size cap (see C1).

### M5. `/api/health` cannot report unhealthy

```ts
return NextResponse.json({ status: 'degraded', database: 'disconnected', ... },
  { status: 200, headers: corsHeaders });  // ← 200 on database failure, by design
```

The comment explains the intent (the Electron client wants to know the server is reachable), but the consequence is that any load balancer, uptime monitor, or platform health check keyed on the status code will never mark this application unhealthy. Split it: `/api/health` for the monitor with a real status code, `/api/health/reachable` for the desktop client. It also sets `Access-Control-Allow-Origin: *` and leaks `process.uptime()`.

### M6. Superadmin hard-delete is unsafe at scale and irreversible

`DELETE /api/superadmin/presses/[id]`:

- destroys Cloudinary media **before** opening the DB transaction — if the transaction then fails, media is gone and rows remain,
- loads every cardholder for the press with no pagination,
- issues one sequential `cloudinary.uploader.destroy` per cardholder, guaranteeing a timeout on a large press and leaving deletion half-finished,
- offers no dry-run or confirmation step, and writes an audit entry with a hardcoded `ipAddress: '127.0.0.1'`.

### M7. Audit logging covers 7 of 96 routes, and records false IPs

Only 7 route files touch the audit log. Several superadmin routes — including the `CRITICAL`-severity hard-delete — hardcode `ipAddress: '127.0.0.1'` rather than reading `x-forwarded-for`, which puts fabricated data in the record you would rely on during an incident.

### M8. The security tests test a copy of the security code

`tests/unit/tenant-isolation.test.ts` is candid about it:

> *"we replicate the extension's argument-rewriting logic and assert that it injects the correct tenant filters. […] This is a faithful copy of the logic at src/lib/prisma.ts lines 189–260."*

The 21 tenant-isolation tests and much of `security.test.ts` never import the module they are named after. They will keep passing after `src/lib/prisma.ts` changes or regresses. There are no route-level or integration tests anywhere. The 80 green tests are worth substantially less than the number suggests.

### M9. `next build` applies migrations to the live database

```json
"build": "export DIRECT_URL=\"$DATABASE_URL\" && prisma migrate deploy && prisma generate && next build"
```

Every build — including preview deploys — runs `prisma migrate deploy` against whatever `DATABASE_URL` resolves to. There is no rollback path and no separation between preview and production databases. Move migrations to a deliberate release step.

---

## Low / hygiene

| # | Finding |
|---|---|
| L1 | `.env.example` is **untracked** — `.gitignore` matches `.env*`, so the env template is not in the repo. Add `!.env.example`. |
| L2 | 876 ESLint errors, 271 warnings — predominantly `no-explicit-any`. Lint runs in neither the build nor CI. |
| L3 | No CI at all. Build, typecheck, tests, lint, and `npm audit` all pass or fail only on a developer's machine. |
| L4 | `middleware.ts` is deprecated in Next 16 — the build warns to rename it to `proxy`. Given the entire authorization model lives there, do this deliberately rather than under time pressure. |
| L5 | Sentry `disableLogger` is deprecated; switch to `webpack.treeshake.removeDebugLogging`. |
| L6 | No `Content-Security-Policy` header. `next.config.ts` sets HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy — CSP is the notable gap, and the app accepts SVG uploads. |
| L7 | Business config hardcoded in a route handler: `pricePerCard = 50.0` and `taxPercent = 18.0` in `src/app/api/jobs/route.ts`. Changing GST requires a redeploy. |
| L8 | `Cardholder.cardSerial` has no unique constraint, and the portal generates `C-${Date.now()}-${rand(1000)}` — collidable, with nothing at the database level to catch it. |
| L9 | `assignSerialNumber` has a find-or-create race: two concurrent first-uses of a prefix both miss, both insert, one gets a P2002 and 500s. The `increment` itself is atomic and safe. Use an upsert. |
| L10 | `PressUser.email` is **globally** unique, not unique per press — one person cannot hold accounts at two presses. Likely unintended for a multi-tenant SaaS. |
| L11 | `publicRoutes` matching is `startsWith`, so `/api/v1` makes every future `/api/v1/*` route public by default. Current `/api/v1` routes do authenticate via API key, so this is a trap for later, not a live hole. |
| L12 | 113 uncommitted modified files. What is deployed cannot be reconstructed from git. |
| L13 | Repo hygiene: `dev.log`, `scratch/`, `artifacts/`, `model_photos/`, `.stitch/`, ~2.4MB of PDFs and a 467KB `tsconfig.tsbuildinfo` in the project root; stale `audit.md` and `plan.md`; a stray non-migration `prisma/migrations/manual_add_audit_log.sql` (harmless — the table *is* created by migration `20260709133252` — but misleading). |

---

## What is genuinely well built

Stated plainly, because it affects how much of this report is rework versus targeted fixes:

- **Credit concurrency is correct.** Both `/api/press/deduct-credits` and `/api/marketplace/purchase` take `SELECT … FOR UPDATE` row locks inside interactive transactions before reading and decrementing balances. Promo credits and paid credits are separated, and marketplace purchases correctly refuse promo credits. This is the part most codebases get wrong.
- **Tenant isolation is centralized**, not sprinkled per-route — including the subtle detail of rewriting `findUnique` to `findFirst` because `pressId` is not part of any unique constraint, and using a distinct `buyerPressId` column for `TemplatePurchase`.
- **Cross-tenant reads are explicit.** The marketplace paths import `basePrisma` deliberately and re-authorize by hand; I checked `marketplace/download` and it correctly gates on owner-or-purchaser.
- **Soft-delete cascades are ownership-checked.** `DELETE /api/clients/[id]` verifies ownership through the scoped client *before* dropping to `basePrisma` for the cascade — the pattern that would be an IDOR if done in the other order.
- **Password and JWT handling are standard and correct** — bcrypt, `jose` HS256, httpOnly + `secure` in production + `sameSite: lax`, 7-day user tokens, 12-hour admin tokens.
- **`src/lib/config.ts` enforces JWT secret entropy at boot** — minimum 32 characters and a weak-pattern blocklist that throws in production. Uncommon and genuinely good.
- **Portal token routes are properly scoped.** I specifically probed `portal/org/[orgToken]/cardholders/[id]` for IDOR; it constrains by `clientId` derived from the share on both PUT and DELETE.
- **Raw SQL is parameterized throughout.** No injection found; there are no `$queryRawUnsafe` call sites.
- **PDF compilation is offloaded** to the desktop daemon, which sidesteps the serverless timeout problem entirely.

---

## Remediation order

**Before launch — non-negotiable**

1. C1 — lock down `analyze-pdf` (allowlist, path containment, size cap, generic errors).
2. C2 — delete `/api/test-db`.
3. C3 — make the Stripe webhook reachable and fix the `OR: [{}, …]` match-everything bug.
4. C4 — add `vercel.json` cron, make `/api/cron` reachable, delete `/api/jobs/cleanup`.
5. C5 — `next` ≥ 16.2.11, `sharp` ≥ 0.35.4, `adm-zip` ≥ 0.6.0.
6. H2 — role checks on `marketplace/purchase` and `deduct-credits`.
7. H4 — provision Upstash; rate-limit `/api/portal/upload`.

**First week after**

8. H1 — make tenant isolation fail closed; wire up or delete `verifyMiddlewareHeaders`.
9. H3 — derive credit deduction server-side.
10. M4 — cap every `take` and every import.
11. M5 — split the health endpoint so monitors can see failure.
12. L3 — CI running build, typecheck, test, lint, and audit.

**First month**

13. M8 — replace the replicated-logic tests with tests that import `src/lib/prisma.ts`, and add integration tests for the authorization boundary.
14. M1/M2/M3 — double-write consistency and the `findUnique` global-template inconsistency.
15. M6/M7 — safe superadmin deletion; real audit coverage and real IPs.
16. M9 — migrations out of the build step.
17. L4 — the `middleware` → `proxy` migration, done deliberately.

---

## Limits of this audit

Stated so the clean areas are not over-read:

- **No runtime testing.** No server was started and no request was sent. Findings are from source analysis plus build/test/audit tooling. C3 and C4 in particular are strong static conclusions from the middleware's control flow, but they are worth confirming with one live request each.
- **The desktop client was not audited.** `desktop-client/` is excluded from `tsconfig.json` and was out of scope, yet it holds a long-lived credential and drives the credit-deduction path (H3).
- **The frontend was not audited** for XSS or client-side authorization leakage; ~57k lines across 217 files, and this pass prioritized the server boundary.
- **No load or performance testing.** M3 and M4 are reasoned from code shape, not measured.
- **Production environment variables were not inspected** — only local `.env` and `.env.example`. Whether Upstash, Stripe, and `CRON_SECRET` are set in the deployment target could not be verified from here, so H4's severity depends on facts I cannot see.
