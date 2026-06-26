# IDexo Project Audit

> Reviewed: Next.js 16 app + Electron desktop client + Prisma/Postgres schema

---

## 🔴 Critical — Fix Immediately

### 1. `.env` has a weak JWT secret committed to local dev
**File:** `.env`
```
JWT_SECRET="super-secret-press-token-key-2026"
```
This is a guessable, human-readable secret. In production it should be a 256-bit random value (`openssl rand -hex 32`). The `.env` is gitignored but the pattern is risky — if it ever leaks (CI logs, crash dumps, shared dev machine), sessions can be forged.

**Fix:** Rotate immediately in production Vercel env vars. Use a long random string.

---

### 2. No rate limiting on any API endpoint
There is zero rate limiting on authentication routes (`/api/press/login`, `/api/press/signup`, portal enrollment, etc.). This allows brute-force and credential-stuffing attacks.

**Fix:** Add edge-compatible rate limiting (e.g. `@upstash/ratelimit` with Vercel KV, or simple in-memory with `lru-cache` for dev) to login + signup + portal enroll routes in middleware.

---

### 3. No input validation on API request bodies
No Zod/Yup schemas anywhere in API routes. Fields are destructured directly from `request.json()` and passed to Prisma. Example from `orders/[id]/route.ts`:
```ts
const { status, notes, validTill, deliveredTo, deliveredBy, ... } = await request.json();
```
A malicious client can send unexpected types (objects instead of strings, very long strings, XSS payloads in `notes` fields, etc.).

**Fix:** Add `zod` input parsing at the top of every POST/PUT handler. Reject early with 400.

---

### 4. `xlsx` package has known prototype-pollution CVE
The `xlsx` package (version `^0.18.5`) is the old **SheetJS Community Edition** which has had critical ReDoS and prototype pollution vulnerabilities. It hasn't received security patches.

**Fix:** Migrate to the maintained fork `exceljs` or use SheetJS Pro. At minimum pin to the latest 0.18.x and audit what untrusted user data passes through it (the batch-import route parses user-uploaded XLSX files — highest risk surface).

---

## 🟠 High — Should Fix Soon

### 5. `cardholderIds` is a JSON string column, not a relation
**File:** `schema.prisma` — `CardOrder.cardholderIds: String`

Storing IDs as a JSON blob (`"[1, 2, 3]"`) defeats relational integrity. You can't:
- Query "which orders contain cardholder X?" efficiently
- Enforce FK constraints
- Use Prisma's `include` for cardholder data
- Get accurate counts without parsing JSON (you're doing `JSON.parse(order.cardholderIds || '[]').length` in **15 places** across the codebase)

**Fix:** Add an `OrderCardholder` join table with `orderId` and `cardholderId`. This will require a migration and a refactor pass.

---

### 6. Audit log `actorName` is hardcoded to `'Operator'`
**Files:** `orders/[id]/route.ts:121`, `orders/route.ts:98`, `orders/[id]/clone/route.ts:69`

The middleware injects `x-user-id` and `x-user-role`, but `actorName` is never looked up from DB — it's always the literal string `"Operator"`.

**Fix:** Either pass actor name in the JWT payload (add `name` to token — already in `UserSessionPayload` interface but not used in activity logs) or do a quick `prisma.pressUser.findUnique({ select: { name: true } })` before writing the audit log. The JWT approach is more efficient.

---

### 7. `customFields` and `frontFields/backFields` are untyped JSON strings
Multiple models store structured data as raw JSON strings (`Cardholder.customFields`, `CardTemplate.frontFields`, `CardTemplate.backFields`). This means:
- No type safety at DB level
- Every consumer does `JSON.parse(...)` manually with no error handling in some paths
- Schema migrations are invisible to Prisma

**Fix (pragmatic):** Keep JSON strings but define TypeScript interfaces for the shapes and create helper functions (`parseCustomFields(raw: string | null): CustomFields`) to centralize parsing with error handling. Ideally migrate to Postgres `Json` type with Prisma's `Json` scalar so at least the DB enforces valid JSON.

---

### 8. Dashboard layout is `'use client'` with an auth fetch on every render
**File:** `dashboard/layout.tsx`

The layout is a client component that fires `fetch('/api/press/profile')` on mount to check auth. This means:
1. Every dashboard page load flashes a spinner while the profile is fetched
2. The middleware **already** verified the JWT and injected `x-user-id` + `x-press-id` headers — the round-trip fetch is redundant
3. Server Components can read cookies directly — no client fetch needed

**Fix:** Convert the dashboard layout to a Server Component. Read the session via `getSession()` directly. Pass `profile` as a prop to a thin client wrapper that just handles the sidebar state.

---

### 9. `autoUpdater` CDN URL points to a domain you may not own
**File:** `desktop-client/package.json`
```json
"url": "https://cdn.studentidsystem.com/press-client/releases/"
```
If this domain isn't owned/secured, an attacker who takes it could push malicious updates to every installed client (auto-download is `true`). The app then auto-installs on quit.

**Fix:** Verify you own this CDN domain and it uses HTTPS with a valid cert. If not live yet, set `autoUpdater.autoDownload = false` and prompt the user before downloading. Consider code-signing the releases.

---

## 🟡 Medium — Worth Planning

### 10. Pervasive `useState<any>` and `as any` — 19 + 22 occurrences
TypeScript is barely earning its keep. `useState<any>(null)` for profile, client, template data across most dashboard pages means type errors silently pass. You lose autocomplete, refactoring safety, and catch shape mismatches at compile time.

**Fix:** Define interfaces for API response shapes. Start with the most-used ones: `PressProfile`, `CardOrder`, `Client`, `CardTemplate`.

---

### 11. `alert()` used for error feedback — 15 occurrences
Portal pages and dashboard pages use native `window.alert()` for errors. This:
- Blocks the JS thread
- Breaks on mobile WebViews
- Looks terrible and unprofessional

**Fix:** You already have an `error` state pattern in most components. Use the existing `alert-danger` CSS class for inline error messages instead of `alert()`. You have a `ConfirmDialog.tsx` component — extend it to a general toast/notification system.

---

### 12. The landing page (`page.tsx`) is 1,541 lines in a single file
**File:** `src/app/page.tsx` — 1,541 lines

This is an unmaintainable monolith. Features are buried and impossible to test in isolation. The timeline, FAQ, testimonials, hero, pricing — all mixed together.

**Fix:** Extract into named components under `src/app/components/landing/` (e.g., `HeroSection.tsx`, `PricingSection.tsx`, `TestimonialsSection.tsx`, `WorkflowTimeline.tsx`).

---

### 13. `clients/[id]/page.tsx` is 2,548 lines
Same issue — the single largest page. Contains client detail, cardholder table, serial assignment, portal share management, and bulk import — all in one component with shared state. This causes re-renders of the whole tree for any state change.

---

### 14. Dashboard layout has no mobile responsiveness
**File:** `dashboard/layout.tsx`

The sidebar is a fixed `width: '280px'` with no `@media` query. On screens < 900px the layout breaks. The entire dashboard is only usable on desktop.

**Fix:** Add a hamburger toggle and a mobile drawer. The `aside` should be `position: fixed` on mobile and toggled with a state variable.

---

### 15. Enroll portal page re-parses template JSON fields redundantly
**File:** `portal/enroll/[enrollToken]/page.tsx`

`frontFields` and `backFields` are parsed 3 separate times in the same render pass (lines 66-68, 291-295, 308-311) with `JSON.parse`. Each render triggers all three.

**Fix:** Memoize with `useMemo` so the parsed field arrays are computed once.

---

### 16. ImageCropper uses stale closure in event listeners
**File:** `src/app/components/ImageCropper.tsx` — lines 66-79

The `useEffect` for drag listeners captures `handleMouseMove` which closes over `dragStart` state, but `handleMouseMove` itself is not in the dependency array. If `dragStart` changes while dragging (which it does), the effect won't re-register with the new value — leading to stale state bugs.

**Fix:** Either use `useCallback` for `handleMouseMove` and include it in the deps array, or use a `ref` for `dragStart` instead of state.

---

## 🔵 Low / Polish

### 17. `next.config.ts` has massively duplicated `outputFileTracingExcludes`
The same canvas/sharp exclusion arrays are copy-pasted 8 times with slight path variations. This suggests the tracing config doesn't work as intended (the path formats differ — some have leading `/`, some don't). 

**Fix:** Consolidate exclusions into a shared array, use the correct glob format, and test with `next build`.

---

### 18. Scratch/dev files committed to the repo root
Files like `create-zip.ts`, `inspect-db.ts`, `read-excel.ts`, `plan.md` (56KB!), `id card setting.pdf`, `sample_cardholders.xlsx`, `model_cardholders.xlsx` are in the repo root. These are dev artifacts, not production code.

**Fix:** Move to a `scripts/` or `dev/` folder and add them to `.vercelignore` (most are already there). Remove binary files (PDFs, ZIPs, XLSXs) from version control entirely — use git-lfs or just `.gitignore` them.

---

### 19. Update CDN release URL mismatch
`desktop-client/package.json` references `cdn.studentidsystem.com` but the app itself points to `idexocards.vercel.app`. Branding is inconsistent in the app ID (`com.studentidsystem.pressclient`) vs. the product name (`IDexo`).

---

### 20. No tests
Zero test files found anywhere. For a system handling financial invoices, PDF generation, and multi-tenant data isolation, this is a significant risk. At minimum:
- Unit test the serial number generation (`serials.ts`)
- Integration test the order state machine transitions
- E2E test the portal enrollment flow

---

## Summary Table

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | Weak JWT secret | 🔴 Critical | Low |
| 2 | No rate limiting | 🔴 Critical | Medium |
| 3 | No input validation | 🔴 Critical | High |
| 4 | `xlsx` CVE risk | 🔴 Critical | Medium |
| 5 | `cardholderIds` JSON string instead of relation | 🟠 High | High |
| 6 | Hardcoded `actorName: 'Operator'` in audit logs | 🟠 High | Low |
| 7 | Untyped JSON fields throughout schema | 🟠 High | Medium |
| 8 | Dashboard layout does redundant auth fetch | 🟠 High | Medium |
| 9 | Auto-updater CDN ownership risk | 🟠 High | Low |
| 10 | `useState<any>` / `as any` everywhere | 🟡 Medium | High |
| 11 | `alert()` for error feedback | 🟡 Medium | Low |
| 12-13 | Monolithic page files (1500–2500 lines) | 🟡 Medium | High |
| 14 | No mobile responsive dashboard | 🟡 Medium | Medium |
| 15 | Redundant JSON.parse in enroll page render | 🟡 Medium | Low |
| 16 | Stale closure in ImageCropper | 🟡 Medium | Low |
| 17 | Duplicated next.config exclusions | 🔵 Low | Low |
| 18 | Dev artifacts in repo root | 🔵 Low | Low |
| 19 | Branding inconsistency in Electron config | 🔵 Low | Low |
| 20 | No tests | 🔵 Low | Very High |
