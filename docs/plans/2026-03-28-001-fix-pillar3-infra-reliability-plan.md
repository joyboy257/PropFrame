# Plan: Pillar 3 — Infrastructure & Reliability

## Overview

Fix reliability and infrastructure issues that prevent safe production operation: orphaned R2 storage, Redis connection leaks in health checks, missing cleanup jobs, zombie clip records, and incomplete env var documentation.

## Problem Frame

Pillar 3 items address operational hygiene and infrastructure integrity. The system has no orphaned storage cleanup, no periodic maintenance jobs, and an incomplete environment variable清单.

## Requirements Trace

- R1. Project/photo/clip deletion removes R2 objects
- R2. Health check uses singleton Redis (no connection leak)
- R3. Daily session cleanup job runs without blocking web requests
- R4. Daily invitation expiry job marks stale invitations
- R5. Clip processing timeout resets stuck clips
- R6. `.env.local.example` contains all required vars

## Scope Boundaries

- No changes to BullMQ worker architecture (Item 14 is resolved — only one worker exists)
- Cron jobs run on Vercel standard cron (max 1 cron/minute per route)
- No changes to Supabase RLS policies

## Open Questions

### Deferred to Implementation

- **R2 cleanup approach**: Delete R2 objects before or after DB transaction? If DB delete fails after R2 cleanup, objects are orphaned anyway. Best approach: issue R2 deletes in parallel with DB delete (don't block on R2 completion).
- **Cron secret**: Vercel cron routes need `CRON_SECRET` env var verification. Confirm pattern used in existing cron routes.
- **Clip timeout threshold**: 10 minutes is stated in TODOs. Confirm that's appropriate for GPU clip generation (can take 2-5 minutes).

## Implementation Units

---

- [ ] **Unit 1: Item 14 — GPU worker consolidation (mark resolved)**

**Goal:** Mark item as resolved — only one worker system exists.

**Requirements:** N/A

**Files:** Modify: `TODOS.md`

**Approach:**
1. `gpu-worker/` directory does not exist. `workers/video-render/` is the only video worker.
2. Mark Item 14 `[DONE]` with note: "`gpu-worker/` does not exist — `workers/video-render/` is the sole video worker (BullMQ + Redis). No duplicate processing risk."

**Verification:** TODOs.md Item 14 shows `[DONE]`

---

- [ ] **Unit 2: Item 17 — Health check Redis leak + Item 20 — env var completeness**

**Goal:** Fix Redis connection leak in health check, add missing env vars to `.env.local.example`.

**Requirements:** R2, R6

**Dependencies:** None

**Files:**
- Modify: `app/api/health/route.ts`
- Modify: `.env.local.example`

**Approach — Health check:**
1. Check if `lib/redis.ts` exists with a singleton Redis connection
2. If yes: import and use it instead of creating new connection per request
3. If no: create a module-level Redis instance (singleton pattern) in the route file itself, reuse across requests
4. Key insight: `app/api/health/route.ts` is not a route handler exported from a Next.js route file — it's a plain file. Importing it would require restructuring. Better approach: add module-level singleton inside the route file.

**Approach — env vars:**
1. Add `JWT_SECRET` to `.env.local.example` with comment explaining it must be set in production (required for session signing)
2. Check for any other missing env vars by grepping for `process.env.` across the codebase

**Patterns to follow:** `lib/auth/cookies.ts` or `lib/db/auth.ts` for how JWT_SECRET is used

**Verification:**
- Health check: load test with 100 rapid pings — Redis connection count stays bounded
- `.env.local.example`: `grep 'JWT_SECRET' .env.local.example` returns a line

---

- [ ] **Unit 3: Item 15 — R2 file cleanup on delete**

**Goal:** `DELETE /api/projects/[id]` and related deletes issue R2 `DeleteObject` calls.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `lib/storage/r2.ts` or augment `lib/r2.ts` with `deleteR2Object(storageKey)` helper
- Modify: `app/api/projects/[id]/route.ts` (DELETE handler)
- Modify: `app/api/photos/[id]/route.ts` (DELETE handler if exists)
- Modify: `app/api/clips/[id]/route.ts` (DELETE handler if exists)

**Approach:**
1. Create `lib/storage/r2.ts` with `deleteObject(storageKey: string): Promise<void>` using `@aws-sdk/client-s3` `DeleteObjectCommand`
2. In `DELETE /api/projects/[id]`: before DB delete, fetch all photos and clips for the project, collect their `storageKey` values, issue `deleteObject()` for each in parallel with `Promise.allSettled`
3. Same pattern for photo delete: delete the photo's `storageKey`; if photo has clips, delete those clip storageKeys too
4. Clip delete: delete clip's `storageKey`
5. Don't fail the request if R2 delete fails — log and continue (R2 lifecycle policy will eventually clean up orphaned objects)

**Patterns to follow:**
- `workers/sky-replace/src/r2.ts` — R2 client setup with `@aws-sdk/client-s3`
- `app/api/projects/[id]/route.ts` — existing DELETE handler pattern

**Test scenarios:**
- Delete project → R2 objects deleted, DB records gone
- R2 delete fails (network error) → DB records still deleted, error logged
- Project with 50 photos → all storageKeys collected and deleted

**Verification:** Manual test: upload photo, note R2 key, delete photo, verify R2 object is gone

---

- [ ] **Unit 4: Items 16, 18, 19 — Cron jobs (session cleanup, invitation expiry, clip timeout)**

**Goal:** Add three maintenance cron route handlers.

**Requirements:** R3, R4, R5

**Dependencies:** None (can run in parallel with Unit 3)

**Files:**
- Create: `app/api/cron/cleanup-sessions/route.ts`
- Create: `app/api/cron/cleanup-invitations/route.ts`
- Create: `app/api/cron/cleanup-stuck-clips/route.ts`
- Modify: `vercel.json` (add cron entries) or check if Vercel cron config exists

**Approach — session cleanup:**
1. GET (or POST — Vercel cron uses GET) handler at `/api/cron/cleanup-sessions`
2. Verify `Authorization: Bearer $CRON_SECRET` header (prevent unauthorized cron triggers)
3. `DELETE FROM sessions WHERE expiresAt < NOW()`
4. Return `{ deleted: rowCount }`

**Approach — invitation expiry:**
1. Handler at `/api/cron/cleanup-invitations`
2. Same auth check
3. `UPDATE organizationInvitations SET status = 'expired' WHERE status = 'pending' AND expiresAt < NOW()`
4. Return `{ updated: rowCount }`

**Approach — stuck clips:**
1. Handler at `/api/cron/cleanup-stuck-clips`
2. Same auth check
3. `UPDATE clips SET status = 'queued', updatedAt = NOW() WHERE status = 'processing' AND updatedAt < NOW() - INTERVAL '10 minutes'`
4. Return `{ reset: rowCount }`

**Vercel cron config:**
Check if `vercel.json` exists. If it has a `crons` section, add all three. If not, create or append:

```json
{
  "crons": [
    { "path": "/api/cron/cleanup-sessions", "schedule": "0 0 * * *" },
    { "path": "/api/cron/cleanup-invitations", "schedule": "0 0 * * *" },
    { "path": "/api/cron/cleanup-stuck-clips", "schedule": "*/10 * * * *" }
  ]
}
```

**Patterns to follow:**
- `lib/db/auth.ts:72` — session deletion SQL pattern
- `app/api/health/route.ts` — CRON_SECRET verification pattern (check if used)

**Test scenarios:**
- Session cleanup: create expired session, run cron, session is gone
- Invitation expiry: create pending invitation with past `expiresAt`, run cron, status = 'expired'
- Stuck clip: create clip with `processing` + old `updatedAt`, run cron, status = 'queued'

**Verification:** Each cron route returns `{ deleted/updated/reset: N }` on success

## System-Wide Impact

- **R2 cleanup**: Project/photo/clip deletion becomes slower (R2 calls add latency) — use `Promise.allSettled` to not block
- **Cron jobs**: Run on Vercel cron (1/minute limit per route). Three cron routes = three cron jobs
- **Session cleanup**: Deletes expired sessions — safe, idempotent

## Risks & Dependencies

- R2 cleanup: Network failures can leave orphaned objects — mitigated by logging failures, not blocking delete
- Cron auth: CRON_SECRET must be set in production env vars (add to `.env.local.example`)
- Clip timeout: 10-minute threshold may need tuning based on actual GPU job durations

## Verification Strategy

After all units complete:
1. Health check: rapid ping doesn't exhaust Redis connections
2. `.env.local.example`: `JWT_SECRET` and `CRON_SECRET` present
3. Project delete: R2 objects deleted
4. Cron routes: return success JSON with row counts
5. TODOs.md: Items 14, 17, 20 marked `[DONE]`
