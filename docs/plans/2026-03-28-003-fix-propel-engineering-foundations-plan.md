---
title: Propel — Engineering Foundations Fix Pack
type: fix
status: active
date: 2026-03-28
deepened: 2026-03-28
---

# Propel — Engineering Foundations Fix Pack

## Overview

Fix 12 identified bugs, security gaps, and product inconsistencies across the PropFrame codebase. This is a codebase health pass: zero new features, zero scope expansion — only defect correction, security hardening, and architectural cleanup. All changes are backward-compatible unless safety requires otherwise.

## Problem Frame

PropFrame has accumulated engineering debt across three axes:

- **Production-breaking bugs**: BullMQ singleton bug causes queue/Redis reference mismatch on cold start; Runway API calls hit a dev endpoint that will break in production; `createUser()` grants 1000 credits instead of the documented 40.
- **Security/infrastructure gaps**: In-memory rate limiter is ineffective in serverless (resets on cold start); Stripe webhook has no replay protection; `deductCreditsWithOrgPool` crashes when an org has no credit pool row.
- **Product integrity gaps**: Music "AI generation" is hardcoded CDN URLs with no AI; no billing portal means no self-service; no credit expiry creates balance-sheet liability; auth middleware is defined but unused — every route re-implements auth manually.

## Requirements Trace

- R1. No Stripe checkout session is processed twice (idempotency)
- R2. BullMQ workers reconnect reliably on serverless cold starts
- R3. All Runway AI video generation hits the production API endpoint
- R4. Signup credit bonus matches documented value (40 credits, not 1000)
- R5. Rate limiting works correctly across serverless warm/cold invocations
- R6. Org credit pool operations do not crash on empty pool rows
- R7. Auth is implemented consistently across all API routes
- R8. Clip storage keys are traceable from clipId to R2 key
- R9. Users can self-serve manage billing (Stripe billing portal)
- R10. Music feature is either AI-generated or its 8-credit cost is removed
- R11. Credits have an optional expiry mechanism
- R12. Replicate API calls degrade gracefully when the service is degraded

## Scope Boundaries

- No new database migrations beyond what is required for the fixes above
- No changes to credit pricing, SGD pricing, or billing calculations
- No changes to the org model (directors, agents, pool hierarchy)
- No changes to SPEC.md — this is a defect correction pass, not a specification change
- No changes to AI model selection (Runway Gen-3, Flux Fill Dev, RMBG-1.4)

## Key Technical Decisions

- **Rate limiter**: Replace in-memory `Map` with `@upstash/ratelimit` + Redis (already in stack as `ioredis`). Upstash Ratelimit is the standard choice for Vercel serverless + Redis stacks. Keep the in-memory limiter as dev/staging fallback.
- **Stripe webhook idempotency**: Add `stripeEventId text UNIQUE` column to `creditTransactions`. Check-before-insert pattern. If Stripe ever replay-fires the same event, the unique constraint catches it and the insert fails cleanly.
- **Auth consolidation**: Keep the current per-route manual auth pattern (getSessionToken + verifyToken). Remove the unused `withAuth` wrapper from `lib/middleware.ts` — dead code is a maintenance hazard. The per-route pattern is explicit and works fine.
- **Music resolution**: Remove the 8-credit cost from music track selection in `lib/music.ts` and auto-edits route. Music is CDN-hosted, not AI-generated — charging 8 credits is misrepresentation. Add a note that AI music generation is a future feature.
- **Circuit breaker**: Use the `opossum` library for Runway API calls. It is framework-agnostic, works in both Node.js and BullMQ worker contexts, and has a standard Redis fallback for distributed deployments.
- **Business address**: Extract to `NEXT_PUBLIC_BUSINESS_ADDRESS` env var (used in legal pages and footer) so a single change propagates everywhere.

## Open Questions

### Resolved During Planning

- **Signup credit amount**: Confirmed 40 credits = $10 free tier from schema default. `createUser()` must be updated to 40, not 1000. Plan: align `auth.ts` line 36 to `40`.
- **BullMQ singleton bug**: Confirmed `_connection` is overwritten when `_queue` is null but `_connection` already exists. Fix: create connection first, reuse it. Pattern from `workers/auto-edit-render/src/queue.ts` is the reference.
- **Runway endpoint**: Confirmed `api.dev.runwayml.com` is the dev endpoint. Fix: change to `api.runwayml.com` (production). No env var needed — dev/staging should use the same prod endpoint for realistic testing.
- **deductCreditsWithOrgPool id bug**: Confirmed select only fetches `amount` but `pool.id` is used in where clause. Fix: add `id` to the select list.
- **Music credit cost**: Confirmed music is hardcoded CDN URLs, not AI-generated. 8-credit cost is not defensible. Fix: remove the credit charge from music track selection and add a `// TODO: AI music generation` comment.
- **Circuit breaker library**: `opossum` is the standard Node.js circuit breaker. It integrates cleanly with BullMQ workers via `circuitBreaker.ts` helper.

### Deferred to Implementation

- **Stripe billing portal URL**: The billing portal redirect URL (`/api/billing/portal` → Stripe portal) requires a frontend billing page that doesn't yet exist. Deferred to implementation — the API route can be built now, but the portal redirect UX needs a landing page.
- **Credit expiry**: Requires a cron job and a `expiresAt` column on personal `creditTransactions`. The org pool already has expiry logic (`addOrgCredits` sets 1-year default). Personal credit expiry needs a new DB column and a cleanup cron. Scope: implement `expiresAt` column + cron job in a separate unit if time permits.
- **Music AI generation**: Not implemented anywhere. Removing the 8-credit charge is the immediate fix. AI generation is a separate feature.

## Implementation Units

- [ ] **Unit 1: BullMQ Redis singleton fix**

**Goal:** Fix queue/Redis reference mismatch that causes workers to lose connection on cold start.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `workers/video-render/src/queue.ts`

**Approach:**
Fix the initialization order. The bug: `getClipQueue()` creates a new Redis instance even when `_connection` already exists, orphaning the old connection held by the existing queue.

```typescript
// Before (buggy):
if (!_queue) {
  _connection = createRedisInstance();  // ← overwrites existing
  _queue = new Queue(..., { connection: _connection });
}

// After (correct):
if (!_connection) _connection = createRedisInstance();
if (!_queue) {
  _queue = new Queue(CLIP_QUEUE_NAME, { connection: _connection, ... });
}
```

This mirrors the pattern in `workers/auto-edit-render/src/queue.ts` which does not have this bug.

**Patterns to follow:** `workers/auto-edit-render/src/queue.ts` — module-level singleton with lazy init, connection created before queue.

**Test scenarios:**
- Queue is initialized, then `getClipQueue()` is called again → same queue returned
- Queue is null but connection already exists → connection is reused, not recreated
- Worker process starts cold → BullMQ connects to Redis successfully

**Verification:** `grep "_connection = createRedisInstance" workers/video-render/src/queue.ts` returns 1 occurrence (inside `if (!_connection)`).

---

- [ ] **Unit 2: Runway API endpoint — dev → production**

**Goal:** Fix production-breaking dev endpoint reference.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `workers/video-render/src/replicate.ts`

**Approach:**
Change `BASE_URL` from `https://api.dev.runwayml.com/v1` to `https://api.runwayml.com/v1`. No env var — the production endpoint is the correct target for all environments. Dev/staging testing should also use production for realistic results.

Update the comment on line 33 that still references `api.dev.runwayml.com`.

**Patterns to follow:** Existing `generateClipVideo` / `pollRunwayJob` function signatures — no interface changes.

**Test scenarios:**
- `generateClipVideo()` makes a fetch call to `api.runwayml.com` (not `api.dev.runwayml.com`)
- No environment-specific conditional logic introduced

**Verification:** `grep "api.dev.runwayml.com" workers/video-render/src/replicate.ts` returns zero matches. `grep "api.runwayml.com" workers/video-render/src/replicate.ts` returns ≥1.

---

- [ ] **Unit 3: Signup credit amount — 1000 → 40**

**Goal:** Align `createUser()` with the documented and schema-default of 40 credits.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `lib/db/auth.ts`

**Approach:**
Change line 36 in `createUser()` from `credits: 1000` to `credits: 40`.

This aligns with the schema default (`lib/db/schema.ts` line 53: `default(40)`) and the documented free tier.

**Patterns to follow:** Existing `createUser` function — only the literal value changes.

**Test scenarios:**
- New user signup → account created with 40 credits, not 1000
- Signup flow end-to-end → user receives 40 credits

**Verification:** `grep "credits: 1000" lib/db/auth.ts` returns zero matches. `grep "credits: 40" lib/db/auth.ts` returns ≥1.

---

- [ ] **Unit 4: Stripe webhook idempotency**

**Goal:** Prevent duplicate credit creation on Stripe webhook replay.

**Requirements:** R1

**Dependencies:** None (DB migration runs independently)

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`
- Modify: `lib/db/schema.ts` (add column — migration needed)
- Create: Database migration to add `stripeEventId text UNIQUE` to `creditTransactions`

**Approach:**
1. **Schema**: Add `stripeEventId: varchar('stripe_event_id', { length: 255 })` column to `creditTransactions`. Add unique constraint. This is a backward-compatible additive column.

2. **Webhook handler**: On `checkout.session.completed`, read `event.id` from the Stripe event. Before inserting credits, attempt to insert `creditTransactions` with `stripeEventId: event.id`. If the unique constraint rejects the duplicate, the second insert silently fails — which is correct behavior.

```typescript
// In webhook handler, before credit insertion:
if (event.type === 'checkout.session.completed') {
  const eventId = event.id;  // Stripe's event ID
  // ... parse session ...

  // Check if already processed (belt-and-suspenders, unique constraint is primary guard)
  const [existing] = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.stripeEventId, eventId))
    .limit(1);

  if (existing) {
    // Already processed — Stripe replayed this event
    return NextResponse.json({ received: true });
  }

  // ... existing credit insertion logic, now includes stripeEventId ...
  await db.insert(creditTransactions).values({
    // ... existing fields ...
    stripeEventId: eventId,
  });
}
```

Note: `stripeEventId` is nullable in the schema to avoid breaking existing rows. The unique constraint only applies to non-null values.

**Patterns to follow:** Existing webhook handler pattern. `stripe.Event` type from `stripe` SDK includes `id: string`.

**Test scenarios:**
- Stripe fires `checkout.session.completed` twice with same event ID → second insert raises unique constraint error or returns early (belt-and-suspenders check)
- Stripe fires different `checkout.session.completed` events → both insert successfully
- Existing historical rows (stripeEventId = null) are unaffected

**Verification:** `creditTransactions` table has `stripeEventId` column. Webhook handler checks/event.id before insert. `grep "stripeEventId" app/api/webhooks/stripe/route.ts` returns ≥1.

---

- [ ] **Unit 5: deductCreditsWithOrgPool null/id bug**

**Goal:** Fix crash when org has no credit pool row; fix incorrect id reference.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `lib/db/auth.ts`

**Approach:**
Two bugs in `deductCreditsWithOrgPool`:

**Bug 1** (line 165–172): Select only fetches `amount`, but `pool.id` is used in the where clause at line 179. Fix: add `id` to the select.

```typescript
// Before (buggy — pool.id is selected but pool.id is never fetched):
const [pool] = await db
  .select({ amount: organizationCredits.amount })  // ← missing id
  .from(organizationCredits)
  .where(and(...))
  .limit(1);

// After (correct):
const [pool] = await db
  .select({ id: organizationCredits.id, amount: organizationCredits.amount })
  .from(organizationCredits)
  .where(and(...))
  .limit(1);
```

**Bug 2** (line 174–189): When `pool` is undefined (org has no credit pool row), the code falls through to the personal credits path correctly — but `pool.amount >= amount` on line 174 will throw `TypeError: Cannot read properties of undefined` before reaching the fallback. Fix: explicit null guard.

```typescript
// Add null guard before using pool:
if (!pool) {
  // Fall through to personal-only path below
} else if (pool.amount >= amount) {
  // org pool full deduction path
} else if (pool.amount > 0) {
  // org pool partial deduction path
}
// personal-only path follows
```

Also fix `pool as any` casts (lines 179, 200) — they exist because `id` was missing from the select. After fixing the select, the casts are no longer needed.

**Patterns to follow:** Existing `deductCreditsWithOrgPool` function — fix only the broken paths.

**Test scenarios:**
- Agent in org with no credit pool row attempts clip generation → falls through to personal credits (correct)
- Org with pool amount exactly equal to deduction → full pool deduction (was broken by missing id)
- Org with partial pool deduction → partial from pool + rest from personal (was broken by missing id)

**Verification:** `grep "pool as any" lib/db/auth.ts` returns zero matches. `grep "{ id: organizationCredits.id" lib/db/auth.ts` returns ≥1.

---

- [ ] **Unit 6: Remove dead withAuth middleware; clean up lib/middleware.ts**

**Goal:** Remove unused auth wrapper to eliminate maintenance hazard.

**Requirements:** R7

**Dependencies:** None

**Files:**
- Modify: `lib/middleware.ts`

**Approach:**
`withAuth` in `lib/middleware.ts` is defined but never imported in any route. All 31 API routes use the explicit `getSessionToken` + `verifyToken` pattern inline. `withAuth` is dead code.

The `authMiddleware` function (which returns a payload or `NextResponse`) is also unused — it was intended as Next.js middleware but is not wired into `middleware.ts` export chain.

Action: Replace `lib/middleware.ts` contents with the single `getSessionToken` helper from `lib/auth/cookies.ts` re-export, or simply document that the auth pattern is per-route explicit. Best action: keep `lib/middleware.ts` minimal — export only `getSessionToken` and `verifyToken` from it, both already in `lib/auth/cookies.ts` and `lib/db/auth.ts`.

Actually: The simplest correct fix — delete the `withAuth` wrapper export and `authMiddleware` from `lib/middleware.ts`. Keep the file with a comment explaining the per-route auth pattern. Or: move the file to `lib/api-auth-reference.ts` with a deprecation comment.

Decision: Delete the `withAuth` function entirely. Keep `authMiddleware` (it documents the auth flow even if not wired as Next.js middleware). Rename the file to `lib/auth-reference.ts` to make clear it's reference documentation, not active middleware.

**Patterns to follow:** None — this is dead code removal.

**Test scenarios:**
- All existing API routes continue to work (no behavioral change — dead code removal)
- `grep "withAuth" app/api/**/*.ts` returns zero matches
- `grep "from.*middleware" app/api/**/*.ts` returns zero matches

**Verification:** No route imports `withAuth` or `authMiddleware`. `lib/middleware.ts` still exists as `lib/auth-reference.ts` with inline documentation.

---

- [ ] **Unit 7: Redis-backed rate limiting with Upstash Ratelimit**

**Goal:** Replace ineffective in-memory rate limiter with Redis-backed limiting that survives serverless cold starts.

**Requirements:** R5

**Dependencies:** Unit 1 (BullMQ fix must land first since both use Redis)

**Files:**
- Modify: `lib/ratelimit.ts`
- Modify: `app/api/auth/signup/route.ts` (if it imports ratelimit)
- Modify: `app/api/auth/login/route.ts` (if it imports ratelimit)

**Approach:**
Install `@upstash/ratelimit` and `@upstash/redis`. The existing `ioredis` in the stack is for BullMQ, not Upstash — Upstash has its own HTTP-based Redis client.

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Multi-tenant rate limiter: 5 requests per minute per IP
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: 'sliding_window',
  rate: '5/60s',
  analytics: true,
  prefix: 'ratelimit:auth',
});

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const { success, remaining, reset } = await ratelimit.limit(ip);
  if (!success) {
    return { allowed: false, retryAfter: reset };
  }
  return { allowed: true };
}
```

Keep the in-memory fallback as the dev fallback when Upstash env vars are not configured:

```typescript
// Dev fallback when REDIS_UPSTASH_* env vars are absent
const ratelimit = process.env.REDIS_UPSTASH_REST_URL
  ? new Ratelimit({ ... })
  : null;  // null = use in-memory Map

// checkRateLimit then:
// if (!ratelimit) return checkRateLimitInMemory(ip);
```

Env vars needed: `REDIS_UPSTASH_REST_URL`, `REDIS_UPSTASH_REST_TOKEN` (from Upstash dashboard).

**Patterns to follow:** Existing `checkRateLimit(ip)` signature — return type is unchanged. Upstash's `limit()` returns `{ success: boolean, remaining: number, reset: number }`.

**Test scenarios:**
- 6 requests from same IP in 60 seconds → 6th request returns `{ allowed: false }`
- Serverless cold start → rate limiting state persists in Redis, not lost
- Dev environment (no Upstash env vars) → falls back to in-memory limiter

**Verification:** `grep "@upstash/ratelimit" lib/ratelimit.ts` returns ≥1. `grep "ratelimit" app/api/auth/signup/route.ts` returns ≥1.

---

- [ ] **Unit 8: Stripe billing portal endpoint**

**Goal:** Add self-service billing management (invoices, payment method, cancellation).

**Requirements:** R9

**Dependencies:** None

**Files:**
- Create: `app/api/billing/portal/route.ts`
- Modify: `components/dashboard/DashboardNavbar.tsx` or billing page to add portal link

**Approach:**
```typescript
export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { customerId } = await req.json();
  const user = await getUserById(session.userId);
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
```

Frontend: Add a "Manage Billing" button on the billing/dashboard page that POSTs to this endpoint and redirects to `portalSession.url`.

Note: This requires `stripeCustomerId` to be set on the user at signup or after first purchase. Currently it may be null for existing users — handle that with a 404.

**Patterns to follow:** Existing billing routes pattern (`app/api/billing/checkout/route.ts`).

**Test scenarios:**
- Authenticated user with stripeCustomerId → returns Stripe portal URL
- Unauthenticated request → 401
- User without stripeCustomerId → 404 with message "No billing account found"

**Verification:** `POST /api/billing/portal` with valid session returns `{ url: "https://billing.stripe.com/..." }`.

---

- [ ] **Unit 9: Traceable clip storage keys using clipId prefix**

**Goal:** Make clip storage keys traceable from clipId without a DB lookup.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Modify: `workers/video-render/src/processor.ts`
- Modify: `lib/r2.ts` (if storage key generation is there)

**Approach:**
Currently `processor.ts` generates a random `nanoid()` for the R2 storage key:
```typescript
const storageKey = `clips/${job.clipId}/${nanoid()}.mp4`;
```

The `nanoid()` makes the key non-deterministic — given just the clipId, you can't derive the storage key without a DB query.

Fix: Use a deterministic storage key derived from clipId:
```typescript
const storageKey = `clips/${job.clipId}/${job.clipId}.mp4`;
```

Or more readably:
```typescript
const storageKey = `clips/${job.clipId}/rendered.mp4`;
```

This is backward-compatible — existing clips in R2 already have the nanoid-style keys, and they are indexed by `clipId` in the DB anyway. New clips use the deterministic key. No migration needed.

**Patterns to follow:** Existing R2 storage key path pattern (`clips/${job.clipId}/...`).

**Test scenarios:**
- New clip generation → storage key is `clips/{clipId}/rendered.mp4`
- Given a clipId, storage key can be computed without a DB lookup
- Existing clips (nanoid keys) are unaffected

**Verification:** `grep "nanoid()" workers/video-render/src/processor.ts` returns zero matches for storage key generation.

---

- [ ] **Unit 10: Remove 8-credit music cost; add AI generation TODO**

**Goal:** Remove the misleading 8-credit charge for music that is not AI-generated.

**Requirements:** R10

**Dependencies:** None

**Files:**
- Modify: `lib/music.ts`
- Identify and modify: Any route that deducts 8 credits for music selection (likely `app/api/auto-edits/route.ts` or similar)

**Approach:**
1. In `lib/music.ts`: Remove the 8-credit cost from `MUSIC_TRACKS` export and add a comment:
```typescript
// TODO (future): AI-generated music. Currently using copyright-free CDN tracks.
// When AI music generation is implemented, add credit cost here and remove this comment.
export const MUSIC_TRACK_COST = 0; // Currently free (CDN tracks, not AI-generated)
```

2. Find where music credits are deducted (likely `app/api/auto-edits/[id]/route.ts` or related). Remove the credit deduction for music selection.

3. If `MUSIC_TRACK_COST` is used anywhere, ensure it is `0`.

**Patterns to follow:** Existing `MUSIC_TRACKS` constant structure — no structural changes.

**Test scenarios:**
- Music track selected → no credits deducted
- Music selection UI shows tracks as free (or as "Coming Soon: AI music")
- No credit transaction of type `music_generation` is created

**Verification:** `grep "music_generation" lib/music.ts` returns zero (no such type). `MUSIC_TRACK_COST === 0` is true.

---

- [ ] **Unit 11: Credit expiry mechanism**

**Goal:** Add optional credit expiry for personal credit balances.

**Requirements:** R11

**Dependencies:** DB migration (add `expiresAt` column)

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `app/api/cron/cleanup-expired-credits/route.ts`
- Modify: `lib/db/auth.ts` (add expiry check in credit deduction)

**Approach:**
This is a larger change — implement only if time permits in this session, otherwise defer.

**DB change**: Add `expiresAt: timestamp('expires_at')` to `creditTransactions` for personal credit rows. Org pool credits already have expiry in `organizationCredits.expiresAt`.

**Auth change**: In `deductCredits` and `deductCreditsWithOrgPool`, add a filter to exclude expired credits when calculating available balance.

**Cron job**: `cleanup-expired-credits` cron (runs daily) marks expired personal credit transactions and logs them.

If deferred: Document as a separate feature in TODOS.md with note: "Requires daily cron job + DB migration + balance recalculation logic."

**Patterns to follow:** Existing `expiresAt` pattern in `organizationCredits` schema (`lib/db/schema.ts`).

**Test scenarios:**
- Credit with expiresAt in the past → excluded from available balance
- Cron job → marks expired credits correctly
- Credit without expiresAt → treated as never expiring (null = no expiry)

**Verification:** `creditTransactions` has `expiresAt` column. Cron route exists at `app/api/cron/cleanup-expired-credits/route.ts`.

---

- [ ] **Unit 12: Circuit breaker for Replicate/Runway API calls**

**Goal:** Prevent cascading failures when Runway API is degraded.

**Requirements:** R12

**Dependencies:** Unit 2 (Runway endpoint fix)

**Files:**
- Create: `lib/circuitBreaker.ts`
- Modify: `workers/video-render/src/replicate.ts`

**Approach:**
Install `opossum`: `npm install opossum`

```typescript
// lib/circuitBreaker.ts
import CircuitBreaker from 'opossum';

const BREAKER_OPTIONS = {
  timeout: 30000,       // If Runway takes >30s, trip
  errorThresholdPercentage: 50,  // Trip if >50% failures
  resetTimeout: 30000,   // Try again after 30s
};

export function createRunwayBreaker(fn: () => Promise<unknown>) {
  return new CircuitBreaker(fn, BREAKER_OPTIONS);
}
```

Wrap `generateClipVideo` in the worker:
```typescript
// In replicate.ts or processor.ts:
const runwayBreaker = createRunwayBreaker(() =>
  generateClipVideo({ imageUrl, motionStyle, customPrompt, resolution })
);

const result = await runwayBreaker.fire();
```

If Runway is degraded, the circuit trips and fails fast (instead of queueing timeouts). When it recovers, the breaker resumes.

**Patterns to follow:** BullMQ retry already provides resilience at the job level. The circuit breaker adds resilience at the API call level within the job processor.

**Test scenarios:**
- Runway API returns 500 → circuit trips after 2 failures
- Subsequent requests → fail fast (no timeout wait)
- After 30s reset timeout → circuit half-open, allows one probe request
- Probe succeeds → circuit closes, normal operation resumes

**Verification:** `workers/video-render/src/replicate.ts` imports `opossum`. `grep "opossum" package.json` returns ≥1.

---

## System-Wide Impact

- **Unit 1 (BullMQ)**: Workers reconnect reliably. No other surface changes.
- **Unit 4 (Stripe idempotency)**: `creditTransactions.stripeEventId` is new nullable column. Existing rows are null — Stripe events never had event IDs stored, so no historical rows can conflict. New Stripe events always have event IDs.
- **Unit 5 (auth null bug)**: Org pool path was crashing all org credit deductions. Fixing it enables org credit pools to work correctly for the first time.
- **Unit 7 (rate limiting)**: All auth endpoints (signup, login) use the new Redis-backed limiter. In-memory limiter remains as dev fallback.
- **Unit 8 (billing portal)**: Users need `stripeCustomerId`. Users created before Stripe checkout was implemented will have null `stripeCustomerId` and will see a 404 from the portal endpoint. Acceptable — they need to make a purchase first to get a Stripe customer ID.
- **Unit 9 (storage keys)**: Old clips retain nanoid keys in R2. The DB `clips.publicUrl` still points to the correct R2 key. New clips use deterministic keys. No migration needed.

## Risks & Dependencies

- **Unit 7 (Upstash)**: Requires Upstash account and Redis database. If env vars are not set, falls back to in-memory limiter (acceptable for dev).
- **Unit 8 (billing portal)**: Requires `stripeCustomerId` on user records. Null for many existing users. 404 is the correct behavior — they must complete a purchase first.
- **Unit 4 (Stripe idempotency)**: The DB migration adds a unique constraint on a nullable column. In PostgreSQL/Drizzle, unique constraints allow multiple nulls — so existing rows with null are fine. New rows always have a non-null `event.id` from Stripe.
- **Unit 11 (credit expiry)**: If implemented in this session, the DB migration + cron job is self-contained. If deferred, it goes to TODOS.md.
- **Unit 9 (storage keys)**: Backward-compatible. Old clips in R2 are unaffected. DB still holds the authoritative `publicUrl`.

## Documentation / Operational Notes

- **Upstash Redis**: Get credentials from [upstash.com](https://upstash.com). Env vars: `REDIS_UPSTASH_REST_URL`, `REDIS_UPSTASH_REST_TOKEN`.
- **Stripe billing portal**: Enable billing portal in Stripe Dashboard → Settings → Billing → Customer Portal.
- **Circuit breaker reset**: If the breaker trips, it auto-resets. Manual reset: restart the worker process.
- **Runway API**: After Unit 2, all environments use `api.runwayml.com`. If you need a separate dev sandbox, add `RUNWAY_API_URL` env var — but the default must be production.
- **Business address**: After Unit 12, extract to `NEXT_PUBLIC_BUSINESS_ADDRESS` env var. Currently hardcoded in 3 files.

## Sources & References

- BullMQ singleton bug: `workers/video-render/src/queue.ts` lines 15–45
- Runway endpoint: `workers/video-render/src/replicate.ts` line 3
- Signup credits: `lib/db/auth.ts` line 36, `lib/db/schema.ts` line 53
- Rate limiter: `lib/ratelimit.ts` (entire file)
- Stripe webhook: `app/api/webhooks/stripe/route.ts` (entire file)
- Auth middleware: `lib/middleware.ts` (entire file — dead code)
- Music: `lib/music.ts` (entire file)
- Credit pool bug: `lib/db/auth.ts` lines 165–238
- Known issues: `known-issues.md` (items 12, 13, 15, 24–27)
- TODO items: `TODOS.md` (items 24–27, 37)
- Stripe Tax code: `txcd_10402000` — Digital audio visual works (for future GST switchover in Singapore)
