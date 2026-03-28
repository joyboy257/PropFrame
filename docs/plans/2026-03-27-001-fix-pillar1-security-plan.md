---
title: "fix: PropFrame Pillar 1 Security"
type: fix
status: active
date: 2026-03-27
---

# Fix PropFrame Pillar 1 Security

## Overview

Fix 6 security vulnerabilities in PropFrame: JWT secret fallback, Stripe key fallback, inconsistent auth cookie names, credit deduction without row verification, missing clip idempotency, and photo reorder without ownership check.

## Problem Frame

Six security issues — two are hard startup failures (JWT, Stripe), two are auth correctness (cookies), two are data integrity (credit deduction, photo ownership).

## Requirements Trace

- R1. JWT: Remove known-secret fallback. Production must crash at startup if `JWT_SECRET` is absent.
- R2. Stripe: Remove `sk_test_placeholder` fallback. Checkout and webhook routes must fail if key is absent in production.
- R3. Auth cookies: Single canonical cookie name (`session_token`) across all routes. Shared helper function for read.
- R4. Auto-edit credit deduction: Verify `rowCount > 0` after `UPDATE`. Throw if no rows affected.
- R5. Clip generation idempotency: Return existing clip if one is `queued`/`processing` for same photo+style+resolution. Prevent duplicate clips on retry.
- R6. Photo reorder ownership: Verify every photo in the reorder request belongs to the project before updating.

## Scope Boundaries

- Does NOT modify credit deduction helpers in `lib/credits.ts` (separate concern, tracked in Pillar 5)
- Does NOT modify `deductCreditsWithOrgPool` (org credit path handled in Pillar 5)
- Does NOT modify `workers/` directory (worker-level idempotency is separate)
- Does NOT add a test suite (the codebase has no test infrastructure; this is an audit/fix pass)

## Context & Research

### Relevant Code and Patterns

**JWT auth (`lib/db/auth.ts`):**
```typescript
// line 8-11 — current (broken)
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'dev-secret-change-in-production';
```
The throw fires but `JWT_SECRET` is still assigned the fallback, so code using it won't crash — it will silently use the known secret.

**Stripe (`app/api/billing/checkout/route.ts`, `app/api/webhooks/stripe/route.ts`):**
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {...});
```
Payment processing silently fails with the placeholder key.

**Cookie pattern (most routes):**
```typescript
const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
```
`sessions_token` is set by auth routes. `dev_token` is also set in dev mode. A handful of routes use `auth_token`, `auth-token`, or `token` instead.

**Auth routes set cookies (`app/api/auth/login/route.ts`):**
```typescript
response.cookies.set('session_token', token, {...});
if (process.env.NODE_ENV !== 'production') {
  response.cookies.set('dev_token', token, {...});
}
```

**Auto-edit credit deduction (`app/api/auto-edits/route.ts:56`):**
```typescript
await db.execute(sql`UPDATE users SET credits = credits - 1 WHERE id = ${userId} AND credits >= 1`);
```
No check of `result.rowCount`. If user doesn't exist or has 0 credits, 0 rows updated but code proceeds as success.

**Clip idempotency (`app/api/clips/generate/route.ts:57-71`):**
```typescript
const [existingClip] = await db.select().from(clips).where(
  and(eq(clips.photoId, photoId), eq(clips.motionStyle, motionStyle || 'push-in'),
      inArray(clips.status, ['queued', 'processing']))
).limit(1);
if (existingClip) return NextResponse.json({ clip: existingClip }, { status: 200 });
```
Already has pre-check for duplicate in-flight clips. No DB-level unique constraint. Race condition possible under concurrent retry.

**Photo reorder (`app/api/projects/[id]/reorder/route.ts`):**
```typescript
const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
if (!project || project.userId !== payload.userId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
// Then updates photos without verifying ownership:
await Promise.all(photoIds.map((photoId, index) =>
  db.update(photos).set({ order: index }).where(eq(photos.id, photoId))
));
```

### Institutional Learnings

- No `docs/solutions/` found — no prior institutional knowledge to draw on
- No test infrastructure exists in the codebase

### External References

- [JWT Best Practices](https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/) — never use known secret fallbacks
- [Stripe: Server-side SDK best practices](https://stripe.com/docs/security/best-practices) — always validate webhook signatures; never ship with test placeholder keys

## Key Technical Decisions

- **Cookie name**: `session_token` as single canonical name. `dev_token` remains as backward-compat read fallback only during migration (not set going forward).
- **Cookie migration**: Auth routes (`login`, `signup`, `callback`) stop setting `dev_token`. Routes reading `dev_token` as fallback continue to work for existing sessions. New users/devices only get `session_token`.
- **Auto-edit idempotency**: Apply the same pre-check pattern used in `clips/generate` — query for existing pending clip before creating.
- **No new DB constraint for clips**: The pre-check is sufficient for the retry-protection use case. A true unique constraint on `(photo_id, motion_style)` would prevent users from regenerating a clip with the same style after it's been marked `done` — which is a valid use case. So no constraint added.
- **Session migration**: No session invalidation needed. Sessions store a hash of `tokenId` (nanoid), not the token itself, so cookie name change doesn't invalidate existing sessions.

## Open Questions

### Resolved During Planning

- **Cookie migration strategy**: Keep reading `dev_token` as fallback for existing sessions, but stop setting it on new logins. Sessions remain valid. No forced re-login required.
- **JWT fallback severity**: The current `throw` + fallback chain is dangerous because code using `JWT_SECRET` won't crash even after the throw. Fix by removing the fallback and making the throw the only behavior.
- **Stripe placeholder severity**: Both checkout and webhook routes use placeholder. Checkout fails silently (no error surfaced to user). Webhook may silently fail Stripe signature verification.
- **Auto-edit idempotency vs clip idempotency**: Clips route already has pre-check. Auto-edits route does not — add same pattern.

### Deferred to Implementation

- How to name the new cookie helper function (exact name TBD after reading existing helpers)
- Final list of all routes updated after grep audit
- Whether to add a `result.rowCount` check for the auto-edit render route's `deductCredits` call (separate from the `app/api/auto-edits/route.ts` issue)

## High-Level Technical Design

### Cookie Unification

```
                    ┌─────────────────────────────────────┐
                    │  getSessionToken(req) helper         │
                    │  (new file: lib/auth/cookies.ts)    │
                    └──────────┬──────────────────────────┘
                               │ returns token string | null
           ┌──────────────────┼──────────────────┬──────────────────┐
           │                  │                  │                  │
    ┌──────▼──────┐   ┌───────▼─────┐   ┌──────▼──────┐   ┌────────▼────────┐
    │ route uses   │   │ route uses   │   │ route uses  │   │ route uses     │
    │session_token │   │ auth_token   │   │ auth-token  │   │ token          │
    │ (no change) │   │ (update to   │   │ (update to  │   │ (update to     │
    │             │   │  helper)     │   │  helper)    │   │  helper)       │
    └─────────────┘   └─────────────┘   └─────────────┘   └─────────────────┘
```

### Credit Deduction with Row-Count Check

```
UPDATE users SET credits = credits - 1
  WHERE id = $1 AND credits >= 1
  ─────────────────────────────────
  result.rowCount == 1  →  success, continue
  result.rowCount == 0  →  throw CreditDeductionFailed
```

### Clip Idempotency Pre-Check

```
POST /api/clips/generate
  │
  ├─ Query: SELECT * FROM clips
  │         WHERE photoId = $1
  │         AND motionStyle = $2
  │         AND status IN ('queued', 'processing')
  │         LIMIT 1
  │
  ├─ If found: return { clip: existingClip }  ← idempotent retry
  │
  └─ If not found: INSERT new clip, enqueue job, deduct credits
```

## Implementation Units

- [ ] **Unit 1: Fix JWT_SECRET fallback — lib/db/auth.ts**

**Goal:** Remove known-secret fallback. Application must refuse to start in production if `JWT_SECRET` is unset.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `lib/db/auth.ts`

**Approach:**
Remove the fallback OR chain entirely. The existing `NODE_ENV === 'production'` check should throw, and `JWT_SECRET` should be used directly without fallback:

```typescript
// After fix — JWT_SECRET is required in all environments for safety
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
```

**Patterns to follow:** None — this is a single-file fix

**Test scenarios:**
- `NODE_ENV=production` + no `JWT_SECRET` → throws at module load
- `NODE_ENV=development` + no `JWT_SECRET` → throws at module load (stricter than before — intentional)
- `NODE_ENV=production` + `JWT_SECRET=abc123` → starts normally

**Verification:**
- Import `lib/db/auth.ts` in a Node REPL with no env vars — should throw immediately

---

- [ ] **Unit 2: Fix Stripe secret key fallback — checkout + webhook routes**

**Goal:** Remove `sk_test_placeholder` fallback. Fail at runtime (not startup) if `STRIPE_SECRET_KEY` is absent, since these are route handlers not module initialization.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `app/api/billing/checkout/route.ts`
- Modify: `app/api/webhooks/stripe/route.ts`

**Approach:**
Replace the fallback chain with an explicit guard. On checkout, check at the start of the handler and return 500 if key is missing. On webhook, Stripe SDK itself will fail on first API call — but we should check upfront:

```typescript
// At top of handler, before any Stripe usage:
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not configured');
}
```

**Patterns to follow:** Same pattern as the JWT fix

**Test scenarios:**
- `STRIPE_SECRET_KEY` unset → checkout returns 500 with error message; webhook throws
- `STRIPE_SECRET_KEY=sk_live_...` → normal operation

**Verification:**
- Missing env var triggers a 500 error with message (checkout) or unhandled rejection (webhook — which will be caught by Next.js error boundary)

---

- [ ] **Unit 3: Create shared getSessionToken() helper and update all cookie-reading routes**

**Goal:** Single source of truth for reading auth tokens. Replace all 5 cookie names with one helper.

**Requirements:** R3

**Dependencies:** None (this is the foundation for other auth-dependent work)

**Files:**
- Create: `lib/auth/cookies.ts` — `getSessionToken(req: Request): string | null`
- Modify: All routes listed in the cookie audit (see below)
- Delete: No files deleted — `dev_token` read fallback preserved for existing sessions during migration

**Approach:**
Create a helper that reads tokens in priority order:
```typescript
export function getSessionToken(req: Request): string | null {
  return (
    req.cookies.get('session_token')?.value ||
    req.cookies.get('dev_token')?.value      // backward compat for existing sessions
  );
}
```

Then update ALL routes that read auth cookies to use `getSessionToken(req)` instead of their current inline patterns. This standardizes all cookie reads to one function. Routes that currently check `auth_token`, `auth-token`, or `token` are updated to use the helper (which only checks `session_token` and `dev_token`).

**Routes confirmed to touch (cookie audit results):**
- `app/api/auth/logout/route.ts` — reads `session_token`, deletes `session_token` + `dev_token`
- `app/api/auto-edits/route.ts`
- `app/api/auto-edits/[id]/route.ts`
- `app/api/auto-edits/[id]/render/route.ts` — currently uses `auth-token`
- `app/api/auto-edits/[id]/share/route.ts` — currently uses `auth_token`
- `app/api/billing/checkout/route.ts`
- `app/api/billing/credits/route.ts`
- `app/api/billing/history/route.ts`
- `app/api/billing/usage/route.ts`
- `app/api/clips/[id]/route.ts`
- `app/api/clips/generate/route.ts`
- `app/api/files/[key]/route.ts`
- `app/api/organizations/[id]/invitations/[invitationId]/route.ts`
- `app/api/organizations/[id]/invitations/route.ts`
- `app/api/organizations/[id]/members/[userId]/route.ts`
- `app/api/organizations/[id]/members/route.ts`
- `app/api/organizations/[id]/route.ts`
- `app/api/organizations/[id]/usage/route.ts`
- `app/api/organizations/route.ts`
- `app/api/photos/[id]/route.ts`
- `app/api/photos/[id]/sky-replace/route.ts` — currently uses `token` + `x-token` header
- `app/api/photos/[id]/virtual-stage/route.ts` — currently uses `auth_token`
- `app/api/projects/[id]/photos/route.ts`
- `app/api/projects/[id]/reorder/route.ts`
- `app/api/projects/[id]/route.ts`
- `app/api/projects/route.ts`
- `app/api/upload/confirm/route.ts`
- `app/api/upload/mock/route.ts`
- `app/api/upload/presign/route.ts`
- `app/api/auth/profile/route.ts`

**For sky-replace (`photos/[id]/sky-replace`)** — it uses `x-token` header, `token` cookie, and `dev_token`. This route is unusual (it's the only one reading a header). Update it to use `getSessionToken(req)` as the primary, while preserving the `x-token` header check as a fallback for backward compatibility if the route is called from any existing client code:
```typescript
const token = req.headers.get('x-token') || getSessionToken(req);
```

**Patterns to follow:** Existing pattern in `lib/db/auth.ts` for `getSession` — simple synchronous helper.

**Test scenarios:**
- Request with valid `session_token` cookie → returns token
- Request with only `dev_token` (old session) → returns token (backward compat)
- Request with `auth_token` only (old route using wrong name) → returns null → 401
- Request with no cookies → returns null → 401

**Verification:**
- All routes using cookie-based auth return 401 when no valid token cookie is present

---

- [ ] **Unit 4: Add row-count verification to auto-edit credit deduction**

**Goal:** Verify that the credit UPDATE affected a row before proceeding with auto-edit creation.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `app/api/auto-edits/route.ts`

**Approach:**
The current code at line 56:
```typescript
await db.execute(sql`UPDATE users SET credits = credits - 1 WHERE id = ${userId} AND credits >= 1`);
```
Add row-count check immediately after:
```typescript
const result = await db.execute(sql`UPDATE users SET credits = credits - 1 WHERE id = ${userId} AND credits >= 1`);
if (result.rowCount === 0) {
  return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
}
```

Note: There is also a `deductCredits` helper call at `app/api/auto-edits/[id]/render/route.ts:109`. That call uses the helper which has its own separate issues (no transaction wrapping) — tracked separately in Pillar 5. Only the raw SQL in `app/api/auto-edits/route.ts` is addressed here.

**Patterns to follow:** Existing error response pattern in the same file (other routes return 402 for payment-related errors)

**Test scenarios:**
- User with credits >= 1 → rowCount = 1 → auto-edit created
- User with credits = 0 → rowCount = 0 → 402 returned, auto-edit NOT created
- User not found → rowCount = 0 → 402 returned

**Verification:**
- Attempting to create auto-edit with 0 credits returns 402 and no DB record is created

---

- [ ] **Unit 5: Add idempotency pre-check to auto-edit creation**

**Goal:** Prevent duplicate auto-edits on retry. Auto-edit creation deducts credits, so duplicate creation = duplicate charges.

**Requirements:** R5

**Dependencies:** Unit 4 must land first (both modify `app/api/auto-edits/route.ts`)

**Files:**
- Modify: `app/api/auto-edits/route.ts`

**Approach:**
Apply the same pre-check pattern from `app/api/clips/generate/route.ts`. Before inserting a new auto-edit, check if one already exists with status `queued` or `processing`:

```typescript
// Before INSERT:
const [existing] = await db.select().from(autoEdits).where(
  and(
    eq(autoEdits.projectId, projectId),
    eq(autoEdits.status, 'queued')  // only one in-flight auto-edit per project makes sense
  )
).limit(1);
if (existing) {
  return NextResponse.json({ autoEdit: existing }, { status: 200 });
}
```

**Design note:** Unlike clips (which can have multiple pending clips per photo for different motion styles), auto-edits are per-project (one assembled video per project). So the idempotency key is `(projectId, status=queued/processing)` — simpler than clips.

**Patterns to follow:** The exact pattern in `app/api/clips/generate/route.ts:57-71`

**Test scenarios:**
- First request: no existing pending auto-edit → creates new → deducts credits
- Retry (before first completes): existing pending found → returns existing → credits NOT deducted again
- After first completes (status=done): new request → no existing → creates new

**Verification:**
- Double-sending the same auto-edit creation request only creates one DB record and deducts credits once

---

- [ ] **Unit 6: Add ownership verification to photo reorder**

**Goal:** Verify all photos in the reorder request belong to the project before updating their order.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `app/api/projects/[id]/reorder/route.ts`

**Approach:**
After verifying project ownership (already done), add a batch check that all photo IDs in the request belong to this project:

```typescript
// photoIds = array of photo IDs from request body
const validPhotos = await db.select({ id: photos.id }).from(photos).where(
  and(
    eq(photos.projectId, projectId),
    inArray(photos.id, photoIds)
  )
);
if (validPhotos.length !== photoIds.length) {
  return NextResponse.json({ error: 'Invalid photo IDs' }, { status: 400 });
}
```

This is a simple set reconciliation — if any photo IDs don't belong to the project, reject the entire request.

**Patterns to follow:** Existing ownership check pattern in the same file

**Test scenarios:**
- All photo IDs belong to project → reorder proceeds
- Any photo ID belongs to different project → 400 returned, no changes made
- Empty photoIds array → proceeds (clears order to 0 for all?)

**Verification:**
- Request with a photo from another user's project returns 400

---

## System-Wide Impact

- **Auth cookie changes**: All routes using `getSessionToken()` will now read only `session_token` and `dev_token`. Any client code (mobile app, third-party) still sending `auth_token`, `auth-token`, or `token` will break — but these are internal API routes and no known external clients use these names.
- **JWT startup**: Applications deployed without `JWT_SECRET` will now crash at startup instead of silently using a known secret. Should be caught in CI/staging before production.
- **Stripe**: Missing `STRIPE_SECRET_KEY` in production will now surface as a 500 error instead of silently failing. This is the intended behavior.
- **Photo reorder**: Malformed reorder requests (wrong photo IDs) now return 400 instead of silently ignoring invalid IDs.

## Risks & Dependencies

- **Unit 3 → Unit 5**: Unit 5 (auto-edit idempotency) modifies the same file as Unit 4. Both are included in the same commit. They have no conflict.
- **Unit 3 → Unit 5**: Unit 3 must land before Unit 5's test scenarios can be fully validated (cookie helper is a prerequisite for consistent test setup), but code-wise they're independent.
- **Cookie migration backward compat**: `dev_token` is still accepted as fallback during read. If a user's `dev_token` cookie is set but `session_token` is not (old dev session), the route will still authenticate. This is intentional — no forced re-login.
- **JWT change is breaking**: Any deployment that doesn't set `JWT_SECRET` will now crash. Must be deployed alongside env var configuration. Should be communicated to DevOps before merging.

## Documentation / Operational Notes

- After merging, update `.env.local.example` to include `JWT_SECRET` with a comment that it is required (not optional). Add `STRIPE_SECRET_KEY` as required.
- The `TODOS.md` entry for "JWT fallback" and "Stripe fallback" should be marked complete after these changes land.
- No runbook changes needed — these are silent security hardening with no new failure modes beyond "fails loudly" which is the intent.

## Sources & References

- TODOS.md Pillar 1 items 1-6
- `lib/db/auth.ts` — JWT handling
- `app/api/billing/checkout/route.ts` — Stripe checkout
- `app/api/webhooks/stripe/route.ts` — Stripe webhook
- `app/api/auto-edits/route.ts` — credit deduction + auto-edit creation
- `app/api/clips/generate/route.ts` — idempotency pattern to follow
- `app/api/projects/[id]/reorder/route.ts` — photo reorder
- `app/api/auth/login/route.ts` — cookie-setting pattern
