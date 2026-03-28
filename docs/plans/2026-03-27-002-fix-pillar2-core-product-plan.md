# Plan: Pillar 2 — Core Product Fixes

## Overview

Implement the missing core product features that prevent the app from delivering its primary value promise (assembled listing videos, clip downloads, virtual staging).

## Problem Frame

Five Pillar 2 items are genuinely incomplete and blocking real use:
- **Item 8** — Clip download returns stub URL; users can't download clips
- **Item 9** — Virtual staging is a placeholder; paid feature doesn't work
- **Item 10** — Music URLs are fake relative paths; auto-edit videos have no audio
- **Item 11** — Invitation acceptance endpoint missing; org onboarding is broken

Three items have **stale TODO descriptions** (code is already correct or paths don't exist):
- **Item 7** — Auto-edit render: code already wires BullMQ correctly (TODOs.md is wrong)
- **Item 12** — SVD fallback: `gpu-worker/src/providers/svd_modal_app.py` doesn't exist; video rendering is in `workers/video-render/`
- **Item 13** — Runway endpoint: `gpu-worker/src/providers/runway.ts` doesn't exist

## Requirements Trace

- R1. Clip download: authenticated users get a time-limited R2 signed URL (3600s expiry)
- R2. Virtual staging: receive photo → call Replicate Flux Fill Dev → upload result to R2 → update DB
- R3. Music: real MP3 files accessible via signed URLs or CDN URLs
- R4. Invitation POST: validates token, creates membership, marks invitation accepted

## Scope Boundaries

- No new GPU worker architecture (Items 12/13 are reframed as monitoring/logging issues, not new code)
- No changes to clip generation pipeline (Runway/SVD providers are out of scope)

## Open Questions

### Deferred to Implementation

- **R2 signed URL method**: Use `@aws-sdk/client-s3` `GetObjectCommand` with `Expiration=3600`, or Cloudflare R2's `createPresignedURL()` — depends on which SDK the project already uses. Check `lib/storage.ts` or `lib/r2.ts` before implementing.
- **Replicate model choice**: `black-forest-labs/flux-fill-dev` is the stated model. Confirm it handles interior real estate photos (not just general fill). May need to test.
- **Music file sourcing**: Upload 5 tracks to R2 manually, or use Pixabay CDN URLs (Pixabay's API TOS allows commercial use). Recommend Pixabay CDN as faster path.

## Implementation Units

- [ ] **Unit 1: Clip download signed URL**

  **Goal:** `GET /api/clips/[id]/download` returns a real R2 signed URL instead of redirecting to a non-existent object key.

  **Requirements:** R1

  **Dependencies:** None

  **Files:**
  - Modify: `app/api/clips/[id]/download/route.ts`
  - Create: `lib/storage/clips.ts` (signed URL helper) or augment existing storage lib

  **Approach:**
  1. Read current `app/api/clips/[id]/download/route.ts` — it only does `getPublicUrl()` and redirect, no auth check
  2. Add ownership check: verify clip belongs to current user (join clips→photos→projects→userId)
  3. Use R2 SDK to generate presigned GET URL with 3600s expiry
  4. Return `{ url: signedUrl, expiresIn: 3600 }` instead of redirect

  **Patterns to follow:**
  - `app/api/photos/[id]/download/route.ts` — if it exists, use same pattern for signed URLs
  - `workers/auto-edit-render/src/r2.ts` — R2 client pattern already in use

  **Test scenarios:**
  - Owner fetches download URL → 200 with `{ url, expiresIn }`
  - Non-owner fetches → 403/404
  - Expired URL (mock clock past expiry) → R2 returns 403

  **Verification:**
  - `GET /api/clips/[id]/download` as owner returns `{ url: /R2_URL.*expiresIn=3600/ }`
  - `GET /api/clips/[id]/download` without auth returns 401

---

- [ ] **Unit 2: Virtual staging AI integration**

  **Goal:** `workers/virtual-stage/src/staging.ts` calls Replicate Flux Fill Dev, uploads result to R2, updates DB.

  **Requirements:** R2

  **Dependencies:** None

  **Files:**
  - Modify: `workers/virtual-stage/src/staging.ts` (currently a placeholder)
  - Modify: `app/api/photos/[id]/virtual-stage/route.ts` (may need status update logic)
  - Create: `workers/virtual-stage/src/replicate.ts` (Replicate client wrapper)

  **Approach:**
  1. Worker receives job: `{ photoId, userId, maskPrompt? }`
  2. Fetch photo's R2 storage key from DB
  3. Download photo from R2 to temp file (or pass URL to Replicate)
  4. Call Replicate API: `black-forest-labs/flux-fill-dev` with photo URL + mask
  5. Poll until result ready
  6. Upload result to R2: `staged/{photoId}/{timestamp}.png`
  7. Update `photos` table: `virtualStageUrl`, `virtualStageStatus: 'done'`
  8. On error: update `virtualStageStatus: 'failed'`

  **Patterns to follow:**
  - `workers/sky-replace/src/index.ts` — very similar pattern (receive job, call Replicate RMBG-1.4, update DB)
  - `workers/auto-edit-render/src/r2.ts` — R2 upload pattern

  **Test scenarios:**
  - Happy path: job completes, `virtualStageUrl` populated, status `done`
  - Replicate API error: status `failed`, error logged
  - R2 upload fails: status `failed`, credits NOT deducted (fix from Pillar 1 Item 24)

  **Verification:**
  - Virtual stage job processes successfully and photo's `virtualStageUrl` is a valid R2 URL
  - Failed job correctly sets status to `failed` without deducting credits

---

- [ ] **Unit 3: Real music track URLs**

  **Goal:** Auto-edit videos include actual audio from real MP3 files.

  **Requirements:** R3

  **Dependencies:** None (can run in parallel with Unit 2)

  **Files:**
  - Modify: `lib/music.ts` (currently has fake relative paths)
  - Modify: `workers/auto-edit-render/src/music.ts` (already uses Pixabay CDN — reconcile with lib/music.ts)

  **Approach:**
  1. Check `workers/auto-edit-render/src/music.ts` — it already has real Pixabay CDN URLs for 3 tracks
  2. Compare with `lib/music.ts` — there are discrepancies (lib/music has `upbeat-1` vs `upbeat_track_1`)
  3. Choose approach:
     - **Option A (fastest)**: Update `lib/music.ts` to mirror the working `workers/auto-edit-render/src/music.ts` tracks; add remaining 2 tracks
     - **Option B (better)**: Upload real MP3s to R2, generate signed URLs — more control, no CDN dependency
  4. Recommend Option A to ship fastest; R2 approach can be Phase 2

  **Patterns to follow:**
  - `workers/auto-edit-render/src/music.ts` — the 3 tracks that already have real Pixabay URLs

  **Test scenarios:**
  - `lib/music.ts` exports 5 tracks with valid URLs (not relative paths)
  - FFmpeg worker can fetch and mux each track without 404

  **Verification:**
  - `lib/music.ts` exports all 5 `VALID_MUSIC_KEYS` with absolute HTTPS URLs

---

- [ ] **Unit 4: Invitation acceptance endpoint**

  **Goal:** `POST /api/invite/[token]` creates organization membership and marks invitation accepted.

  **Requirements:** R4

  **Dependencies:** None (can run in parallel with Units 2 & 3)

  **Files:**
  - Create: `app/api/invite/[token]/accept/route.ts` (or extend existing `route.ts` with POST handler)
  - Modify: `app/api/invite/[token]/route.ts` — add POST to existing GET handler file

  **Approach:**
  1. Read existing GET handler in `app/api/invite/[token]/route.ts`
  2. Add POST handler:
     - Validate token exists and `status = 'pending'`
     - Check `expiresAt > NOW()`
     - Check no existing `organizationMembers` row for this user + org
     - Insert `organizationMembers` row with `userId`, `orgId`, `role` from invitation
     - Update invitation `status = 'accepted'`
     - Return `{ membership: { id, orgId, role } }`
  3. Wrap in transaction (drizzle transactions or raw SQL transaction)

  **Patterns to follow:**
  - `app/api/invite/[token]/route.ts` — existing GET handler shows response shape
  - `lib/db/schema.ts` — `organizationMembers`, `organizationInvitations` table definitions

  **Test scenarios:**
  - Valid token → membership created, invitation `accepted`, returns 201
  - Expired token → 400 with `error: 'Invitation expired'`
  - Already-accepted token → 400 with `error: 'Invitation already accepted'`
  - Already-a-member → 400 with `error: 'Already a member'`
  - Invalid token → 404

  **Verification:**
  - `POST /api/invite/[token]` with valid token creates DB row and returns membership
  - Invitation status transitions `pending → accepted`

---

- [ ] **Unit 5: TODOs.md correction**

  **Goal:** Mark Items 7, 12, 13 as resolved/stale; add clarifying notes.

  **Requirements:** N/A (meta)

  **Dependencies:** None

  **Files:**
  - Modify: `TODOS.md`

  **Approach:**
  1. **Item 7** (`auto-edits/[id]/render/route.ts`): Code already wires BullMQ correctly. Mark `[DONE]` with note "Already implemented — TODOs.md description was stale"
  2. **Item 12** (SVD fallback): `gpu-worker/src/providers/svd_modal_app.py` doesn't exist. Reframe as: "Worker code lives in `workers/video-render/`. SVD dispatch is TODO — requires SVDModal API key and async dispatch wiring."
  3. **Item 13** (Runway endpoint): `gpu-worker/src/providers/runway.ts` doesn't exist. Reframe as: "Runway provider lives in `workers/video-render/src/providers/`. Confirm exact endpoint from Runway console."

  **Verification:**
  - TODOs.md Items 7, 12, 13 updated with accurate status and file paths

## System-Wide Impact

- **Unit 1 (clip download)**: Changes `app/api/clips/[id]/download/route.ts` — existing GET handler currently redirects without auth; needs ownership check added
- **Unit 2 (virtual staging)**: Worker at `workers/virtual-stage/` — no existing patterns for this specific worker (sky-replace is similar but different Replicate model)
- **Unit 3 (music)**: `lib/music.ts` used by auto-edit render worker — changing track URLs affects video assembly

## Risks & Dependencies

- Unit 1 depends on R2 SDK being available (check `workers/auto-edit-render/src/r2.ts`)
- Unit 2 depends on Replicate API key being configured and `virtualStageCredits` cost being defined
- Unit 3 is safe to parallelize with Unit 2
- Unit 4 has no external dependencies

## Dependency Graph

```
Unit 1 (clip download)     ─── No dependencies
Unit 2 (virtual staging)    ─── No dependencies
Unit 3 (music URLs)         ─── No dependencies (parallel with Unit 2)
Unit 4 (invite POST)        ─── No dependencies (parallel with Units 2 & 3)
Unit 5 (TODOs correction)   ─── After Units 1–4 decisions confirmed
```

All four implementation units (1–4) can run in parallel.

## Verification Strategy

After all units complete:
1. Clip download: `GET /api/clips/[id]/download` returns signed URL with `expiresIn: 3600`
2. Virtual staging: trigger staging job, verify `virtualStageUrl` populated in DB
3. Music: `lib/music.ts` exports all 5 tracks with absolute HTTPS URLs
4. Invitation: POST valid token, verify `organizationMembers` row created
5. TODOs.md: Items 7, 12, 13 show accurate current state
