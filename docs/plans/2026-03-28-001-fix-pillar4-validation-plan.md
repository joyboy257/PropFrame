---
title: Pillar 4 — Validation & Input Safety + Item 26
type: fix
status: completed
date: 2026-03-28
deepened: 2026-03-28
---

# Plan: Pillar 4 — Validation & Input Safety + Item 26

## Overview

Fix 5 input validation and error-handling bugs across Pillar 4, plus align SPEC.md with the chosen signup credit value (Item 26).

## Problem Frame

Pillar 4 items address dangerous input safety gaps: malformed data accepted without validation, silent credit loss on job enqueue failures, and non-atomic credit operations. Item 26 resolves an ambiguity about what "$10 signup credit" means in credits.

## Requirements Trace

- R1. `cdcNumber` is validated against CEA format before storing
- R2. `resolution` is validated as `'720p' | '1080p' | '4k'` at runtime before processing
- R3. Upload confirm rejects non-image content types
- R4. Sky replacement does not charge credits if the BullMQ job fails to enqueue
- R5. Clip generation credit deduction is atomic with BullMQ enqueue — no partial states
- R6. SPEC.md and DB agree on $10 signup credit value

## Scope Boundaries

- No changes to BullMQ worker architecture
- No changes to existing Zod schemas in workers (already correct)
- Item 27 (package rate inconsistency) is noted but deferred — it is a separate decision

## Key Technical Decisions

- **Validation approach**: All validation is inline in route handlers using explicit type checks — matching the existing codebase pattern (no Zod added to API routes). Type casts are replaced with runtime guards.
- **Enqueue-first pattern for credit operations**: Standardize both Item 24 and Item 25 to enqueue the BullMQ job FIRST, then deduct credits. If enqueue fails, no credits are charged. This avoids the need to roll back after a failed enqueue.
- **Item 25 current state is mostly correct** — clip generation (lines 86-124) already does enqueue-first correctly. The credit deduct failure at lines 116-124 marks the clip errored but leaves the job orphaned (acceptable — job will timeout without processing). No code change needed for Item 25's ordering; add the orphaned-job acknowledgment.
- **Item 24 fix**: Apply the same enqueue-first pattern: enqueue FIRST, then deduct credits + mark photo in a transaction. If enqueue fails, nothing is charged. If deduct fails after enqueue succeeds, the photo is marked but credits haven't moved — this is recoverable.
- **Concurrent sky-replace race condition** (identified by deepen-plan): Two simultaneous sky-replace requests for the same photo can both pass the `skyReplaced` check (line 38) and double-deduct. Fix: add `SELECT FOR UPDATE` lock on the photo row inside a transaction that encompasses the credit check + mark.

## Open Questions

### Resolved During Planning

- **Item 26 — signup credit amount**: Chosen 1,000 credits ($10 at 100/$). DB default already 1,000. No DB change needed. SPEC.md updated to document the rate. Package rate inconsistency (1,250/$ vs 100/$ for signup) flagged to Item 27.

### Deferred to Implementation

- Item 27 (package rate inconsistency) is out of scope — noted for future decision
- `SELECT FOR UPDATE` syntax for the concurrent sky-replace fix — `db.transaction(async (tx) => { const [locked] = await tx.select().from(photos).where(...).for('update').limit(1); ... })` — confirm Drizzle ORM supports this syntax

## Implementation Units

- [x] **Unit 1: Item 21 — cdcNumber format validation** ✓

**Goal:** PATCH `/api/projects/[id]` validates `cdcNumber` against CEA format before storing.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `app/api/projects/[id]/route.ts`

**Approach:**
The PATCH handler currently does not process `cdcNumber` at all — it is missing from the destructuring and `.set()` object. Add `cdcNumber` to destructuring and validate: must match `R\d{6}[A-Z]` (max 50 chars), or be `null`/`undefined` (optional field). Reject invalid with 400.

**Patterns to follow:** Existing PATCH pattern — destructuring with `trim()`, conditional spread in `.set()`.

**Test scenarios:**
- Valid `cdcNumber` (e.g., `R012345B`) → accepted, stored
- Invalid `cdcNumber` (e.g., `ABC`, `R12345`, `r012345b`) → 400 error with message
- Empty string → 400 error
- `null`/`undefined` → accepted (optional field, unchanged)
- `cdcNumber` longer than 50 chars → 400 error

**Verification:**
PATCH with `cdcNumber: "R012345B"` returns 200 and the updated project has that value. PATCH with `cdcNumber: "invalid"` returns 400.

---

- [x] **Unit 2: Item 22 — resolution runtime validation** ✓

**Goal:** `POST /api/clips/generate` validates `resolution` at runtime against `'720p' | '1080p' | '4k'`.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `app/api/clips/generate/route.ts`

**Approach:**
Replace the type-cast-only validation with an explicit runtime check:
```
const VALID_RESOLUTIONS = ['720p', '1080p', '4k'] as const;
if (!VALID_RESOLUTIONS.includes(resolution)) {
  return NextResponse.json({ error: 'Invalid resolution. Must be 720p, 1080p, or 4k' }, { status: 400 });
}
```

**Patterns to follow:** Existing pattern in same file for `motionStyle` validation (should already exist).

**Test scenarios:**
- `resolution: "720p"` → accepted
- `resolution: "1080p"` → accepted
- `resolution: "4k"` → accepted
- `resolution: "480p"` → 400 error
- `resolution: "720P"` (uppercase) → 400 error (case-sensitive)
- `resolution: ""` (empty string) → 400 error (fails `!!''` check before cast)
- `resolution: null` → 400 error (not string, type guard rejects)
- `resolution: 720` (number) → 400 error
- Missing `resolution` → defaults to `'720p'` (existing behavior, keep it)

**Verification:**
`POST /api/clips/generate` with `resolution: "4k"` succeeds. With `resolution: "bad"` returns 400.

---

- [x] **Unit 3: Item 23 — file type validation on upload confirm** ✓

**Goal:** `POST /api/upload/confirm` re-validates content-type and rejects non-image files.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `app/api/upload/confirm/route.ts`

**Approach:**
Use file extension-based validation on `storageKey` as the primary path. The route is called after a presigned URL upload — the server generated the presigned URL and knows the intended filename. Extract the extension from `storageKey` (last segment after `/`) and validate against allowed image extensions. Normalize case-insensitively.

Allowed extensions: `.jpg` (alias `.jpeg`), `.png`, `.heic`, `.webp`.

Also accept an explicit `contentType` field as a secondary check — this catches cases where `storageKey` is a UUID with no extension. Validate `contentType` against allowed MIME types: `image/jpeg`, `image/png`, `image/heic`, `image/webp`. Normalize case-insensitively and strip charset suffixes.

Do NOT make a HEAD request to R2 — it adds latency and R2's content-type headers may not be reliable. The combination of extension + explicit contentType is sufficient.

**Patterns to follow:** Existing upload confirm pattern with project ownership check.

**Test scenarios:**
- `storageKey: ".../photo.jpg"`, `contentType: "image/jpeg"` → accepted
- `storageKey: ".../photo.png"`, `contentType: "image/png"` → accepted
- `storageKey: ".../photo.webp"`, `contentType: "image/webp"` → accepted
- `storageKey: ".../photo.heic"`, `contentType: "image/heic"` → accepted
- `storageKey: ".../photo.JPG"`, `contentType: "image/jpeg"` → accepted (case-insensitive extension)
- `storageKey: ".../uuid-no-ext"`, `contentType: "image/png"` → accepted (contentType is valid)
- `storageKey: ".../photo.pdf"`, `contentType: "application/pdf"` → 400 error (extension rejected)
- `storageKey: ".../photo.jpg"`, `contentType: "text/plain"` → 400 error (contentType doesn't match extension)
- `storageKey: ".../photo.jpg; charset=utf-8"` (charset suffix) → normalize and accept
- `storageKey: ".../photo"` with no extension and no `contentType` → 400 error

**Verification:**
`POST /api/upload/confirm` with valid image extension + contentType succeeds. With `contentType: "application/pdf"` returns 400.

---

- [x] **Unit 4: Item 24 — sky replacement enqueue-first + concurrent race fix** ✓

**Goal:** Reorder sky replacement to enqueue FIRST (then deduct credits), matching clip generation's pattern. Also fix the concurrent sky-replace race condition (two simultaneous requests double-deduct credits).

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `app/api/photos/[id]/sky-replace/route.ts`

**Approach:**
1. **Enqueue-first ordering**: Move `enqueueSkyReplaceJob` BEFORE credit deduction. Current order: deduct (lines 63-73) → mark (76-78) → enqueue (81-95). New order: enqueue → deduct + mark in transaction. If enqueue fails, nothing is charged.

2. **Concurrent race fix**: Wrap the full check-and-charge sequence in a `db.transaction()` with `SELECT FOR UPDATE` on the photo row. This prevents two simultaneous requests for the same photo from both passing the `skyReplaced` check and double-deducting.

New flow:
```
BEGIN TX
  SELECT photo FOR UPDATE (lock row)
  CHECK skyReplaced == false → 409 if true
  ENQUEUE BullMQ job → on failure, ROLLBACK TX (no credits charged)
  UPDATE users SET credits = credits - cost
  INSERT credit_transactions
  UPDATE photos SET skyReplaced = true
COMMIT TX
```

3. **Enqueue failure handling**: The current catch block (lines 91-94) silently swallows the error and returns 202. This must throw instead so the transaction rolls back.

**Patterns to follow:** `db.transaction(async (tx) => { ... })` pattern from `app/api/invite/[token]/route.ts:99`. Drizzle ORM supports `for('update')` on select queries.

**Test scenarios:**
- Happy path → job queued, credits deducted, photo marked
- Enqueue fails (network) → transaction rolls back, credits NOT deducted, photo NOT marked, 500 error returned
- Credit deduction fails after enqueue succeeds → photo marked `skyReplaced=true` but credits not deducted (inconsistent state) — acceptable for now, add a recovery job later
- Concurrent requests (same photo) → only one succeeds, the other waits for lock then gets 409
- Concurrent requests (different photos) → both succeed independently

**Verification:**
Simulate enqueue failure → verify `credit_transactions` has no new row, `photos.skyReplaced` is unchanged, 500 returned.

---

- [x] **Unit 5: Item 25 — verify clip generation ordering is correct** ✓

**Goal:** Confirm clip generation already implements enqueue-first ordering and document the orphaned-job limitation.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `app/api/clips/generate/route.ts` (add explanatory code comment)

**Approach:**
Clip generation (`app/api/clips/generate/route.ts` lines 86-124) already implements the correct enqueue-first pattern:
1. Enqueue first (lines 86-104) — if enqueue fails, clip marked errored, NO credits deducted ✓
2. Deduct second (lines 106-124) — if deduct fails, clip marked errored, orphaned job in queue

The ordering is already correct. The only remaining gap: if deduct fails after enqueue succeeds, the clip is errored but the job is orphaned (acceptable — will timeout without processing). Add a comment to the deduct block documenting this limitation.

No code change required. Add orphaned-job test scenario.

**Patterns to follow:** N/A (no code change)

**Test scenarios:**
- Enqueue succeeds, deduct succeeds → clip queued, credits deducted ✓ (existing happy-path test)
- Enqueue fails → clip marked errored, credits NOT deducted ✓ (existing error test)
- Deduct fails after enqueue succeeds → clip marked errored, orphaned job in queue (acceptable limitation, document in code)

**Verification:**
Code comment added to deduct block explaining orphaned-job consequence.

---

- [x] **Unit 6: Item 26 — SPEC.md + TODOs.md alignment** ✓

**Goal:** Document the $10 signup credit decision (1,000 credits at 100/$). Update SPEC.md to match reality. Flag Item 27 (package rate inconsistency) as deferred.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `SPEC.md`
- Modify: `TODOS.md`

**Approach:**
- SPEC.md: Update credit pricing section to state "$10 free signup credit = 1,000 credits (100 credits/$)" explicitly. Note that package rates are higher (1,250 credits/$ for standard packages) and this is intentional for now.
- TODOS.md Item 26: Mark done, note the decision.
- TODOS.md Item 27: Add a note that package rates are inconsistent (1,250/$ for paid packages vs 100/$ for signup) — this is a business decision for Item 27.

**Verification:**
SPEC.md section on signup credits explicitly says "1,000 credits ($10 free, 100 credits/$)".

## System-Wide Impact

- **Item 24**: `SELECT FOR UPDATE` on the photo row adds a row-level lock. Two simultaneous requests for the same photo will serialize — one waits for the lock. This prevents double-deduct but could create a brief lock contention if many concurrent sky-replace requests target the same photo.
- **Items 24 & 25 now both use enqueue-first ordering**: Both routes deduct credits only after BullMQ confirms the job is queued. This is consistent.
- **Item 21**: `cdcNumber` is displayed on clip overlays — validation now prevents invalid CEA numbers from being stored.
- **Item 22**: `resolution` validation prevents invalid values from reaching the GPU worker.

## Risks & Dependencies

- **Item 24**: `SELECT FOR UPDATE` must be confirmed to work in Drizzle ORM with PostgreSQL. If Drizzle doesn't support `for('update')`, use a different locking strategy (e.g., advisory lock, or `FOR UPDATE` via raw SQL).
- **Item 24**: If the transaction commits but the `/api/cron/cleanup-stuck-clips` job hasn't run, a failed photo stays marked `skyReplaced=true` indefinitely. The cleanup job (every 10 min) should eventually reset it, but this is a window of inconsistent state.
- **Item 23**: Extension-based validation assumes `storageKey` preserves the original filename extension. If the upload flow generates UUID-style keys without extensions, the fallback `contentType` field is required.
- **Item 25**: Orphaned job on deduct-failure is acceptable for now but creates queue pollution. A future cleanup job should expire orphaned jobs older than 5 minutes.

## Documentation / Operational Notes

- Item 24 and 25 error paths now produce visible 500 errors to users instead of silent credit loss or zombie jobs
- SPEC.md updated to be the single source of truth for "what does $10 signup credit mean"

## Sources & References

- TODOS.md Items 21-26
- `app/api/projects/[id]/route.ts` — cdcNumber missing from PATCH
- `app/api/clips/generate/route.ts:24,39` — resolution type cast
- `app/api/upload/confirm/route.ts` — no content-type validation
- `app/api/photos/[id]/sky-replace/route.ts:63-95` — credit then enqueue, no rollback
- `app/api/clips/generate/route.ts:97-124` — credit deduction and enqueue pattern
- `lib/db/schema.ts:53` — `users.credits` default 1000

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run `/autoplan` for full review pipeline, or individual reviews above.

---

## Deepen-Plan Findings (2026-03-28)

A deepen-plan review identified these issues and the plan was updated:

1. **Item 25 plan was inverted** — described deduct-first but actual clip generation code does enqueue-first. Corrected: clip generation already correct, no code change needed. Documented orphaned-job limitation.

2. **Item 24 vs 25 inconsistency** — Item 24 did deduct-first with rollback, Item 25 did enqueue-first. Standardized both to enqueue-first.

3. **Item 24 transaction-with-enqueue risk** — wrapping BullMQ enqueue in DB transaction holds the transaction open during an external call. Corrected to: enqueue first (outside tx), then deduct+mark in transaction.

4. **Item 23 R2 HEAD unreliable** — replaced with extension-based + explicit contentType validation. No network dependency.

5. **Concurrent race in Item 24** — two simultaneous sky-replace requests can double-deduct. Added `SELECT FOR UPDATE` locking fix.

6. **Missing edge cases** — Item 22 test scenarios updated for null, empty string, case sensitivity. Item 23 test scenarios added for charset suffixes, case normalization, no-extension keys.
