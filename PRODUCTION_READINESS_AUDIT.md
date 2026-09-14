# Production Readiness Audit

**Project:** student-id-pdf-system
**Audited:** 2026-09-14 at commit `4891349` + working tree
**Remediated:** 2026-09-14 (same session) — see *Status* on each finding
**Supersedes:** the 2026-09-09 audit at commit `a80c8f1`
**Method:** independent re-audit. Nothing in the previous audit, in `REMEDIATION_PLAN.md`, or in the phase commit messages was taken on trust. Every finding was reproduced against source, a unit test, or a running production build — and every fix was re-verified the same way.

---

## Verdict

**The four critical and four high findings are fixed and verified, and the tree is committed (`b263a37`). One thing still gates launch: `JWT_SECRET` needs rotating.**

The 2026-09-09 remediation (phases 0–7) closed most of the original findings properly. Two things had gone wrong on top of it, and both are now resolved:

1. **Phase 5 had been flipped to fail-closed without Phase 5.3.** The whole public surface — portal, v1 API, both signup flows — returned HTTP 500 on every request. Now resolved: each token-authenticated route establishes its tenant explicitly.
2. **Three new API routes had been added and never reviewed** (`/api/uploads`, `/api/proxy-image`, `/api/storage/presigned`), all untracked, which is why the previous 96-route sweep missed them. One was an unauthenticated arbitrary file read returning `.env`. All three are now hardened.

| Area | 2026-09-09 | At audit | Now |
|---|---|---|---|
| Build / typecheck | ✅ | ✅ | ✅ zero warnings |
| Unit tests | ⚠️ 80, tested a copy | ⚠️ 116, tested a copy | ✅ 122, drive the real extension |
| Integration tests | ❌ | ❌ | ❌ still none across 100 routes |
| CI | ❌ none | ❌ **red** | ✅ every step green |
| Authn / authz | ⚠️ fail-open | ⚠️ 31/100 routes ungated | ✅ signed context; credit routes gated |
| Tenant isolation | ⚠️ fails open | ❌ breaks users **and** forgeable | ✅ fail-closed and unforgeable |
| Secrets handling | ✅ | ❌ `.env` readable over HTTP | ✅ closed — **but rotate the secret** |
| Dependencies | ❌ 9 (1 crit, 6 high) | ⚠️ 6 (3 high) | ✅ 0 |
| Payments | ❌ dead | ✅ | ✅ |
| Data retention | ❌ never ran | ✅ | ✅ |
| Observability | ⚠️ wired | ❌ never initialised | ✅ initialises on server, edge, client |
| Audit logging | ⚠️ 7/96 routes | ❌ 1/100 | ⚠️ 5/100 — security + billing only |

---

## Method

Executed, not inferred — first to find, then to verify:

```
npx prisma generate                     → exit 0
npx tsc --noEmit                        → exit 0
npx vitest run                          → 15 files, 122 tests, all pass
npx next build                          → exit 0 (Next.js 16.3.4, Turbopack), 0 warnings
npm audit --omit=dev --audit-level=high → exit 0   ← the CI gate; was exit 1
npx eslint                              → 1268 problems (was 2826)
npx next start + a 20-case probe suite  → all pass
```

Plus a sweep of all 100 `route.ts` files for authentication signals and tenant-context wrapping; manual reading of the proxy/middleware, the Prisma extension, both auth libraries, the authorization helper and the rate limiter; and `git diff`/`git show` comparison of the tree against `HEAD` to establish what was deployed versus staged.

---

## Critical — all fixed

### C1. Unauthenticated arbitrary file read via `/api/uploads` — disclosed `JWT_SECRET`

`src/app/api/uploads/[...path]/route.ts` joined catch-all segments straight into a filesystem path with no containment check. Percent-encoded separators survive Next's URL normalisation and arrive as a literal `../` inside one segment, so `path.join` walked out of both base directories. The route is public, so no authentication was needed.

```
GET /api/uploads/..%2f..%2f..%2f..%2fetc%2fhostname   → 200  farhan-HP
GET /api/uploads/..%2f..%2f.env                       → 200  the entire .env
```

That second response contained `JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL` and all four `R2_*` credentials — a total authentication bypass, since `JWT_SECRET` also signs the `x-middleware-sig` HMAC every authorization check depends on.

**Status: fixed.** Each path segment is rejected if it is a traversal token, a separator or a NUL, before the filesystem is touched; `resolveWithinDir` then re-checks containment. Served assets also carry `Content-Security-Policy: default-src 'none'; sandbox`, so an SVG that reaches the bucket without passing `sanitizeSvg` cannot execute. Verified: both payloads now 404, legitimate keys still 200.

> **Not yet done, and it is on you:** rotate `JWT_SECRET`, `DATABASE_URL` and the R2 credentials if this tree was ever deployed or its port exposed. The code is fixed; the secrets that were readable are not.

### C2. The portal, the v1 API and both signup flows returned HTTP 500

Phase 5.4 flipped the tenant default to fail-closed; Phase 5.3 — "migrate every caller the logs identify" — was never done. Three routes called `withSystemContext`; **none** called `withPressContext`. Every route reaching a tenant model without a middleware-injected header threw.

```
GET /api/portal/shares/<token>            → 500   [TENANT ISOLATION] ClientPortalShare
GET /api/v1/cardholders  (x-api-key: ...) → 500   [TENANT ISOLATION] PressApiKey
```

**Status: fixed.** Portal handlers call `enterPortalTenant(token)`, which resolves any org/dept/enrol token to its press and adopts it for the rest of the request — one line per handler, so no handler was restructured. `authenticateApiKey` adopts the press behind the API key. Signup routes declare their context explicitly (`enterSystemContext` for press signup, which creates the tenant; the chosen press for client signup, after validating it exists). Verified: 404/401/200 as appropriate, zero isolation errors in the server log.

Two non-obvious defects surfaced while fixing this, both now resolved:

- **The tenant store was split-brained.** Turbopack emits `src/lib/prisma.ts` into more than one server chunk, so the module-scoped `AsyncLocalStorage` was *not* the same object for the code setting the context and the extension reading it — a correctly-wrapped query still looked unscoped. The store is now pinned to `globalThis`, the same pattern the file already used for the `PrismaClient`.
- **`withSystemContext` cannot wrap a `findUnique`.** Prisma batches `findUnique` into a later tick, by which point an `AsyncLocalStorage.run()` scope has unwound. The two tenant-discovery lookups now go through `basePrisma` — the unextended client the codebase already exports for deliberate cross-tenant reads — which is both correct and honest about intent.

### C3. `x-press-id` was client-controlled on every public route

`resolveContext` read the header directly. Middleware overwrote it on authenticated routes, but the public-route branch returned early **before** any header was set, so on those routes the client's own value was used. The HMAC built to detect exactly this was checked by `getActor` and ignored by `resolveContext` — the same header, two different levels of trust.

```
GET /api/portal/shares/nonexistent                      → 500  (blocked)
GET /api/portal/shares/nonexistent  -H 'x-press-id: 1'  → 404  "Invalid or deactivated portal link"
```

The 404 was the tell: the query ran, scoped to press 1, because the caller said so. This was live at `HEAD`, where the null-context path only warned.

**Status: fixed, at both ends.**
- The proxy now strips every injected header (`x-user-id`, `x-press-id`, `x-user-role`, `x-user-name`, `x-tenant-scope`, `x-middleware-sig`) on *every* path, including early returns, before deciding anything.
- `resolveContext` accepts only a signed context. The signature payload now covers a `scope` field, so `system` is a claim only the proxy can make — which is what lets the 12 superadmin routes work without wrapping each one.

Verified: forged `x-press-id`, a forged signature, and a forged `scope: system` all change nothing.

### C4. Sentry never initialised — no runtime error capture

`withSentryConfig` was wired up and all three config files existed, but none ran. There was no `instrumentation.ts` (in v10 the server and edge configs are only loaded by a `register()` hook you write), and `sentry.client.config.ts` is only honoured by the SDK's **webpack** integration — this project builds with Turbopack, where the SDK's own notice says that filename no longer works.

**Status: fixed.** Added `src/instrumentation.ts` (`register()` importing the server/edge config per `NEXT_RUNTIME`, plus `onRequestError = Sentry.captureRequestError`) and renamed the client config to `src/instrumentation-client.ts`. Verified: `.next/server/instrumentation.js` is emitted and its chunks contain the SDK, the configured `tracesSampleRate` and `captureRequestError`. The deprecated `disableLogger` option was removed; the build is now warning-free.

---

## High — all fixed

### H1. `/api/proxy-image` was an unmitigated SSRF

It fetched a caller-supplied URL and returned the body verbatim, with no allowlist, no private-address check, no timeout, no size cap, redirects followed, and `err.message` leaked on failure. The same finding as C1 in the previous audit, fixed thoroughly in `analyze-pdf` and then not applied here.

**Status: fixed, and consolidated.** A host allowlist was the wrong tool — the route legitimately proxies customer-owned photo hosts — so `src/lib/safe-fetch.ts` now refuses to *connect* to anything that is not a public address. The check runs at connect time via the agent's `lookup` hook, which closes the DNS-rebinding window rather than merely narrowing it, and re-runs on every redirect hop. Responses are capped, timed out, constrained to `image/*` and re-served under a sandbox CSP. `analyze-pdf` was moved onto the same helper (keeping its narrower Cloudinary allowlist on top), so there is now one implementation instead of three.

Verified: instance metadata, loopback, bracketed-IPv6 loopback and RFC1918 targets all return an opaque 502.

> A test caught a real hole in the first version of this guard: `URL.hostname` keeps the brackets on an IPv6 literal, so `net.isIP('[::1]')` returned 0 and the range check was skipped entirely. Hostnames are now unbracketed before classification.

### H2. `/api/storage/presigned` handed any authenticated user an arbitrary write key

`prefix` was a free-form caller-supplied string and the extension came from the caller's filename, both interpolated straight into the R2 object key — a write-anywhere-in-the-bucket primitive, including over another tenant's photos. The key contained no `pressId` at all.

**Status: fixed.** The key is derived entirely server-side as `press_<pressId>/<assetType>s/<ts>-<random>.<ext>`, matching `/api/upload`; `assetType` is a closed enum and the extension comes from the validated content type. The route now uses `requireActor` and its rate limit is keyed per press.

Verified: a request carrying `prefix: "../../victim"` and `filename: "x.html"` yields `press_1/photos/1789352811624-6cfb130b16dc32e8.png`.

> This route has **no callers anywhere in the codebase**. It is untracked, so I hardened rather than deleted it — but if it is not part of an in-flight feature, deleting it is the better fix.

### H3. `DESIGNER` could spend and refund the press's credits

Phase 3 gated `press/deduct-credits` and `marketplace/purchase` correctly, but `/api/jobs/*` was missed on both layers: `production-request` deducts credits and `jobs/[id]` POST refunds them, each behind only `requireActor`, and the proxy's designer blocklist covered orders/billing/invoices/clients/cardholders but not jobs.

**Status: fixed.** `requireRole(['OWNER','OPERATOR'])` on `production-request`, `jobs/[id]` POST and `production-complete`; `/api/jobs` added to the designer blocklist as defence in depth.

### H4. CI was red, so nothing was gated

`npm audit --omit=dev --audit-level=high` exited 1 on the tree, so every run since Phase 4 had failed and the `tsc`/`vitest`/`build` steps above it enforced nothing.

**Status: fixed — 0 vulnerabilities in the production tree.**

| Package | Advisory | Resolution |
|---|---|---|
| `deepmerge-ts` (high) | stack exhaustion, via `@prisma/client → prisma → @prisma/config` | `overrides` to `^8.0.0`; `@prisma/config` uses only the `deepmerge` named export, which v8 still provides |
| `adm-zip` (moderate) | extraction follows destination symlinks | bumped to `^0.6.1` |
| `uuid` (moderate) | missing buffer bounds check, via `exceljs` | override scoped to `exceljs` (`^11.1.1`); exceljs uses only `v4`, verified by writing a workbook |

npm's own suggestion was a major *downgrade* of `prisma` and `exceljs`; overrides were the correct remedy. The uuid override is scoped to `exceljs` because a global one collided with `vercel`'s own uuid.

> **Separate defect found here:** `cloudinary` had been removed from `package.json` in the uncommitted work while **11 source files still import it**. It survived only as a stale `node_modules` directory; the first clean `npm ci` would have failed the build. Restored to `^2.10.0`, the version at `HEAD`. An undeclared-dependency check now has no findings.

---

## Medium

### M1. Audit logging — partially closed
Was 1 route of 100 (down from the 7 the previous audit found). Now 5, covering the events that matter most: login success and failure, credit deduction, credit refund, and job-queue credit locking. The helper itself had two defects, both fixed: it derived "is superadmin" from an unsigned `x-super-admin` header, and it read the client IP from spoofable headers — an audit trail that can be forged is worse than none. **Still open:** role and user changes, portal share lifecycle, and superadmin actions are not recorded.

### M2. Tenant isolation tests — fixed
`applyTenantFilter` was an exported second implementation with no production caller, and it had already drifted: no `take` cap, no soft-delete filter, no null-context branch — the exact branch where C2 and C3 lived. It is deleted. `tests/unit/tenant-isolation.test.ts` now captures the real `$allOperations` hook at import and drives it directly: 15 cases covering the unscoped throw, forged and tampered headers, signed tenant and system scopes, `buyerPressId`, global templates, soft deletes, the 5000-row cap, and both explicit wrappers.

### M3. Rate limiting — code fixed, infrastructure still yours
`getClientIp` trusted `x-forwarded-for` and `x-real-ip` unconditionally, so every IP-keyed limit was bypassable by rotating a header off-Vercel. It now trusts `x-vercel-forwarded-for` (which the platform sets and strips), honours the others only when `TRUST_PROXY_HEADERS=true`, and otherwise returns a shared bucket. Because a shared bucket is weak on its own, login gained a **per-account** limit, which holds regardless of IP spoofing. **Still open:** `UPSTASH_REDIS_REST_URL`/`TOKEN` are not configured, so limits remain per-instance and reset on cold start. The code logs `[CRITICAL]` when this happens; nothing enforces it.

### M4. `.env.example` — fixed
It documented Cloudinary at length and never mentioned `R2_*`, though R2 is the storage the app actually uses. Anyone provisioning from the template got a deployment where uploads silently fell through to local disk. R2 is now documented, along with `TRUST_PROXY_HEADERS` and which files read the Sentry DSN.

### M5. `middleware.ts` → `proxy.ts` — fixed
Deprecated in Next 16 and warned on every build. Renamed to `src/proxy.ts` with the export renamed to `proxy`; the build now reports `ƒ Proxy (Middleware)` and emits no deprecation warning.

### M6. CSRF holes — fixed
The check sat *after* the public-route early return, so all 11 portal mutation routes were exempt regardless of the exemption list, and `if (host)` meant a request with an `Origin` and no `Host` skipped the comparison entirely. Both closed: a missing `Host` is now rejected alongside a missing `Origin`, and the exemption list is explicit.

### M7. Prefix matching in the auth perimeter — fixed
`publicRoutes` used `pathname.startsWith(route)`, so `/api/v1` also matched `/api/v1anything`. All perimeter matching — public routes, CSRF exemptions, designer and operator blocklists — now matches on segment boundaries. Verified: `/api/v1x` returns 401 rather than being waved through.

### M8. Superadmin hard-delete at scale — still open
Carried forward from the previous audit's M6, unverified either way. Item 7.5 was not evidenced in the tree and this audit did not write to a live database.

---

## Low / hygiene

- **L1. Lint — halved, still large.** 2826 problems → **1268**. The difference was `public/pdf.worker.min.mjs`, a vendored minified file that accounted for 1557 of them and is now in `globalIgnores`. What remains is real source: 962 errors, mostly `no-explicit-any` and `no-unused-vars`. The previous audit's "1147" was inflated the same way.
- **L2. CSP still allows `'unsafe-eval'` and `'unsafe-inline'`** in `script-src`, in all environments. The rest of the header set is good — HSTS with preload, `nosniff`, `frame-ancestors`, a real `Permissions-Policy`.
- **L3. Uncommitted tree — worse, and now the top risk.** It was 136 modified files and 26 untracked when audited; this session added to that. Phase 1.1 committed the tree specifically so later changes stayed reviewable. Three of the untracked paths are new API routes, two of which were C1 and H1. **Commit this before anything else.**
- **L4. Integration tests — still none** across 100 API routes. C2 was a total outage of the public surface that 116 green unit tests did not notice. The rewritten isolation tests close the specific gap; they do not close the general one.

---

## What is genuinely well built

Unchanged from the audit, and worth restating now the fix list is long:

- **Credit handling is correct.** Server-derived amounts, `SELECT … FOR UPDATE` row locks, idempotent on re-delivery, promo credits spent before paid. The raw SQL carries its own `pressId` filter, acknowledging that raw queries bypass the extension.
- **The serial-number race is fixed** with a single atomic `upsert` + `increment`.
- **Cron auth fails closed** with a length-checked `timingSafeEqual`, wrapped in `withSystemContext`, on a real Vercel cron entry.
- **The Stripe webhook is reachable, CSRF-exempt and system-scoped.**
- **The health check reports 503** on a failed `SELECT 1`.
- **`requireRole` / `requireActor` were the right abstraction** — HMAC-verified and fail-closed. Adoption was the gap, not the design.

---

## What to do next

1. ~~**Commit the tree.**~~ Done — `b263a37`, with all four gates green (tsc, 122 tests, warning-free build, 0 prod vulnerabilities).
2. **Rotate `JWT_SECRET`, `DATABASE_URL` and the R2 credentials** if this tree was ever deployed or its port exposed (C1).
3. **Provision Upstash** and set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (M3).
4. **Confirm production env**: `CRON_SECRET`, `STRIPE_*`, `NEXT_PUBLIC_SENTRY_DSN`. The code fails closed without them, but "configured" was never verified.
5. **Decide on `/api/storage/presigned`** — delete it if it is not part of an in-flight feature (H2).
6. Then: integration tests (L4), audit-log coverage (M1), superadmin deletion (M8), lint (L1), CSP (L2).

---

## Limits of this audit

- **No live database was written to.** Findings that depend on data volume or production traffic — M8 in particular — are carried forward unverified rather than re-confirmed.
- **Production environment variables were not inspected.** The local `.env` has no `CRON_SECRET`, `UPSTASH_*`, `STRIPE_*` or Sentry DSN. Failure modes are safe (fail closed, log `[CRITICAL]`), but whether Vercel has them is unknown.
- **The desktop Electron client was not audited.** Excluded from build file tracing and out of scope.
- **Client-side code was read only where it called an API under review.** No XSS sweep of the dashboard beyond the CSP and the SVG serving path.
- **Live probing ran against a local `next start`, not Vercel.** Behaviour behind Vercel's proxy may differ for the header-trust findings; C1 and C2 are filesystem- and application-level and are not affected.
- **The fixes are verified by unit tests and black-box probes, not by exercising real user journeys.** The portal, v1 and signup flows were confirmed to reach their handlers and scope correctly with invalid credentials; they were not driven end-to-end with valid tokens against real data.
