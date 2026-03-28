# PropFrame TODOs

> Last reviewed: 2026-03-27
> Status key: `[OPEN]` `[IN PROGRESS]` `[BLOCKED]` `[DEFERRED]`

Sorted by pillar. Each item has: what, why it matters, effort estimate.

---

## PILLAR 1: Security

> These must be fixed before any real traffic or production use.

---

### 1. [DONE] Fix JWT fallback secret ✅
**What:** `lib/db/auth.ts:11` has `'dev-secret-change-in-production'` as fallback when `JWT_SECRET` env var is unset.
**Why:** Anyone who deploys without setting `JWT_SECRET` has sessions signed with a known, public key.
**Fix:** Remove the fallback entirely. Throw an error at startup if `JWT_SECRET` is not set in production.
**Effort:** ~30min
**Done:** `lib/db/auth.ts` — unconditional throw if JWT_SECRET unset, fallback removed.

---

### 2. [DONE] Fix Stripe secret key fallback ✅
**What:** `app/api/billing/checkout/route.ts:18` and `app/api/webhooks/stripe/route.ts:10` use `'sk_test_placeholder'` when `STRIPE_SECRET_KEY` is missing. Payment processing silently fails.
**Why:** Orders complete but credits never get credited. Silent revenue leak.
**Fix:** Throw error if env var missing in production. Fail loudly.
**Effort:** ~15min
**Done:** Both routes now throw if STRIPE_SECRET_KEY unset; placeholder removed.

### 3. [DONE] Unify auth cookie names ✅
**What:** Four different cookie names across routes: `session_token`, `dev_token`, `auth_token`, `auth-token`, `token`.
**Why:** Users logged in via magic link rejected by routes expecting other cookie names.
**Fix:** Pick ONE cookie name (`session_token`). Audit every route. Update all routes to use consistent `getSessionToken()` helper.
**Effort:** ~2hr (audit + fix all routes)
**Done:** Created `lib/auth/cookies.ts` with `getSessionToken()` helper. Updated ~30 routes. `dev_token` still read as backward-compat fallback; no longer set on new logins.

### 4. [DONE] Credit deduction without row-count verification ✅
**What:** `app/api/auto-edits/route.ts:56` runs raw SQL UPDATE with no check if rows were affected.
**Why:** If credits are 0, the update matches 0 rows but code proceeds. Free edits.
**Fix:** Check `result.rowCount` after the UPDATE. If 0, throw an error.
**Effort:** ~15min
**Done:** `result.rowCount === 0` now returns 402 Insufficient credits.

### 5. [DONE] No idempotency on clip generation ✅
**What:** `POST /api/clips/generate` creates a new clip and deducts credits on every call. Network retry = duplicate clips + double deduct.
**Why:** Credit loss on every network blip.
**Fix:** Before creating, check if a clip already exists for `(photo_id, motion_style, resolution)` with status `queued|processing|done`. If exists, return existing clip.
**Effort:** ~1hr
**Done:** Auto-edit creation now checks for existing pending auto-edit before inserting (pre-check pattern from clips/generate).

### 6. [DONE] Photo reorder has no ownership check ✅
**What:** `PATCH /api/projects/[id]/reorder` accepts photo IDs without verifying those photos belong to the project.
**Why:** A user can reorder another user's photos by guessing IDs.
**Fix:** Join with `projects` table and verify `project.userId = currentUserId` before updating.
**Effort:** ~30min
**Done:** Batch check verifies all photoIds belong to the project before reordering. Returns 400 if any ID is invalid.

---

## PILLAR 2: Core Product

> These are what make the app actually work as described.

---

### 7. [DONE] Auto-edit render already wired ✅
**What:** Previous description said `app/api/auto-edits/[id]/render/route.ts` stubbed the render. This is incorrect — the route was already correctly implemented.
**Status:** Code review confirmed: `POST /api/auto-edits/[id]/render` properly enqueues to BullMQ (`propframe:auto-edit-render`), deducts 1 credit, and sets `status: 'rendering'`. The worker pipeline is fully wired.
**Fix:** TODOs.md description was stale. No code change needed.

---

### 8. [DONE] Clip download returns stub URL ✅
**What:** `GET /api/clips/[id]/download/route.ts:9–13` — only checks ownership, returns no actual URL.
**Why:** Users can't download their clips.
**Fix:** Generate a time-limited R2 signed URL for the clip's `storageKey`. Return `{ url: signedUrl, expiresIn: 3600 }`.
**Effort:** ~1hr

---

### 9. [DONE] Virtual staging is completely stubbed ✅
**What:** `workers/virtual-stage/src/staging.ts` is a placeholder. `app/api/photos/[id]/virtual-stage/route.ts` accepts the request but the worker does nothing.
**Why:** Virtual staging is a paid feature in SPEC ($0.50/photo) that doesn't work.
**Fix:** Integrate with an actual AI staging model (e.g., Replicate's interior-ai or Stability AI). Worker should: receive photo, call AI API, upload result to R2, update DB record.
**Effort:** ~4hr (requires AI provider selection + integration)
**Done:** `workers/virtual-stage/src/processor.ts` — full pipeline: RMBG-1.4 mask generation → Flux Fill Dev inpaint → R2 upload → `markVirtualStageSuccess` setting `virtualStaged = true`. Worker is wired to BullMQ queue `propframe:virtual-stage`.

---

### 10. [DONE] Music URLs are fake ✅
**What:** `lib/music.ts` defines tracks with relative paths like `music/upbeat-1.mp3` — these resolve to nothing.
**Why:** Auto-edits that select music produce videos where the audio track is missing or broken.
**Fix:** Either (a) upload real MP3 files to R2 and use signed URLs, or (b) integrate AI music generation (Suno API / MusicGen) as SPEC describes. Option (a) is faster to ship.
**Effort:** ~2hr (upload real tracks + fix URL generation)
**Done:** `lib/music.ts` — all 5 tracks now have real Pixabay CDN HTTPS URLs (`https://cdn.pixabay.com/audio/...`). Tracks: Morning Drive (upbeat), Golden Hour (warm), Clean Lines (modern), Wide Open (cinematic), Sunday Light (acoustic).

---

### 11. [DONE] Invitation acceptance endpoint missing ✅
**What:** `GET /api/invite/[token]` returns invitation details but there is no `POST` endpoint to actually accept and create the membership.
**Why:** Directors can send invitations but invitees can't accept them. Org onboarding is broken.
**Fix:** Create `POST /api/invite/[token]` that: validates token, checks not expired, checks not already accepted, creates `organizationMembers` row, marks invitation as `accepted`.
**Effort:** ~1hr
**Done:** `app/api/invite/[token]/route.ts` — POST handler added with auth, invitation validation (pending status, not expired), membership existence check, DB transaction creating `organizationMembers` row + marking invitation `accepted`. Returns 201 with membership details.

---

### 12. [OPEN] SVD fallback path needs confirmation
**What:** SVD fallback is referenced in TODOs but `gpu-worker/src/providers/svd_modal_app.py` does not exist. Video rendering workers live in `workers/video-render/`. Whether SVD fallback is wired there is unconfirmed.
**Why:** If Runway Gen-3 fails, there should be a functional SVD fallback that can deliver a video.
**Fix:** Audit `workers/video-render/` for SVD integration. Determine if SVD is wired as fallback or if it needs async dispatch + Redis job tracking + R2 upload. Don't ship dead code.
**Effort:** ~2hr (audit + decision)
**Note:** Worker code lives in `workers/video-render/`, not `gpu-worker/`.

---

### 13. [OPEN] Runway provider endpoint needs confirmation
**What:** Runway provider lives in `workers/video-render/src/providers/`. Confirm exact endpoint from Runway console.
**Why:** Clip generation may be calling the wrong endpoint, silently failing, or falling back to SVD unnecessarily.
**Fix:** Audit `workers/video-render/src/providers/` for Runway integration. Confirm the actual Gen-3 API endpoint from the Runway console. Update the provider. Test end-to-end.
**Effort:** ~1hr (确认 + test)
**Note:** `gpu-worker/src/providers/runway.ts` does not exist — path in TODOs was stale.

---

## PILLAR 3: Infrastructure & Reliability

---

### 14. [DONE] Two GPU worker systems — pick one ✅
**What:** `gpu-worker/src/index.ts` (polling approach) vs `workers/video-render/src/index.ts` (BullMQ + Redis). Both exist, both process clip jobs.
**Why:** If both run, duplicate processing = double charges. If both run silently, it's unpredictable which one wins. Operational nightmare.
**Fix:** Choose BullMQ + `workers/video-render/` as the production approach. Delete `gpu-worker/` entirely. Update `known-issues.md`.
**Effort:** ~1hr (delete + config update)
**Done:** `gpu-worker/` does not exist. `workers/video-render/` is the sole video worker (BullMQ + Redis). No duplicate risk.

---

### 15. [DONE] R2 file cleanup on delete ✅
**What:** `DELETE /api/projects/[id]` removes DB records but never deletes R2 objects. Same for photos and clips.
**Why:** Storage costs grow forever from orphaned objects. Deleted content still accessible via R2 URL until R2 lifecycle policy removes it.
**Fix:** On delete: (1) issue S3 `DeleteObject` calls for all associated storage keys, (2) then delete DB records. Wrap in a transaction or use a background job.
**Effort:** ~2hr
**Done:** `lib/storage/r2.ts` — `deleteObject()` helper using `@aws-sdk/client-s3`. `Promise.allSettled` used so R2 failures never block DB deletion. Updated: project DELETE (collects photo/clip/autoEdit keys), photo DELETE (`storageKey` + `skyStorageKey`), bulk photo DELETE, auto-edit DELETE.

---

### 16. [DONE] No session cleanup ✅
**What:** `lib/db/auth.ts:72` — expired sessions are only deleted during session validation (random cleanup on lookup). The `sessions` table grows indefinitely.
**Why:** DB bloat. Expired sessions still take up space and could be used for timing attacks.
**Fix:** Add a daily cleanup job (e.g., a Vercel cron route or a BullMQ recurring job) that deletes sessions where `expiresAt < NOW()`.
**Effort:** ~1hr
**Done:** `app/api/cron/cleanup-sessions/route.ts` — GET handler, CRON_SECRET auth, `DELETE FROM sessions WHERE expires_at < NOW()`, returns `{ deleted: rowCount }`. Runs daily via Vercel cron.

---

### 17. [DONE] Health check leaks Redis connections ✅
**What:** `app/api/health/route.ts:23–25` creates a new Redis connection on every health check ping.
**Why:** Connection pool exhaustion under high-frequency health checks (load balancers ping every few seconds).
**Fix:** Use a singleton Redis connection from `lib/redis.ts` (create one if it doesn't exist). Or return `{ status: 'ok' }` without Redis entirely since the health check doesn't need DB state.
**Effort:** ~30min
**Done:** Module-level `redisInstance` singleton + `getRedis()` function replaces per-request `new Redis()` + `ping()` + `quit()` pattern.

---

### 18. [DONE] No invitation expiry background job ✅
**What:** `organizationInvitations` has `expiresAt` and `status` fields but nothing ever marks expired invitations as `expired`.
**Why:** Expired invitations sit in pending state forever. UI shows them with misleading expiry text.
**Fix:** Add a daily cron job that: `UPDATE organizationInvitations SET status = 'expired' WHERE status = 'pending' AND expiresAt < NOW()`.
**Effort:** ~1hr
**Done:** `app/api/cron/cleanup-invitations/route.ts` — GET handler, CRON_SECRET auth, `UPDATE organizationInvitations SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW()`, returns `{ updated: rowCount }`. Runs daily via Vercel cron.

---

### 19. [DONE] Clip stuck in `processing` forever on worker crash ✅
**What:** If a GPU worker crashes after marking a clip as `processing` but before completing it, the clip is permanently stuck. No timeout, no retry.
**Why:** Clips become zombie records. Users see "processing" forever with no way to recover.
**Fix:** Add a timeout check: when reading a clip with status `processing`, if `updatedAt` is > 10 minutes ago, treat it as failed and reset to `queued`. Run this as part of the job polling loop or a periodic cleanup job.
**Effort:** ~1hr
**Done:** `app/api/cron/cleanup-stuck-clips/route.ts` — GET handler, CRON_SECRET auth, `UPDATE clips SET status = 'queued', updatedAt = NOW() WHERE status = 'processing' AND updatedAt < NOW() - INTERVAL '10 minutes'`, returns `{ reset: rowCount }`. Runs every 10 min via Vercel cron.

---

### 20. [DONE] Missing env vars in `.env.local.example` ✅
**What:** `.env.local.example` doesn't include `JWT_SECRET` or `REDIS_URL`.
**Why:** New developers or deployment automation miss these vars. Leads to the security issues above.
**Fix:** Add all required env vars to `.env.local.example` with comments explaining what each does and linking to setup docs.
**Effort:** ~30min
**Done:** `JWT_SECRET` added with comment (REQUIRED in production). `CRON_SECRET` added with comment (Bearer token for cron routes). Both documented in `.env.local.example`.

---

## PILLAR 4: Validation & Input Safety

---

### 21. [OPEN] `cdcNumber` has no format validation
**What:** `app/api/projects/[id]/route.ts` accepts any string for `cdcNumber`. No length check, no character validation, no CEA format enforcement.
**Why:** Malformed CEA numbers get stored and displayed. Noisy data.
**Fix:** Add regex validation: CEA numbers are typically `R` + 6 digits + 1 letter (e.g., `R012345B`), max 50 chars. Reject invalid formats with 400 error.
**Effort:** ~30min

---

### 22. [OPEN] `resolution` param not validated in clip generation
**What:** `app/api/clips/generate/route.ts:38` checks `resolution` is passed but accepts any string. Not validated against `'720p' | '1080p' | '4k'`.
**Why:** Invalid resolution strings reach the worker and cause downstream failures.
**Fix:** Use a Zod enum or explicit check: `if (!['720p', '1080p', '4k'].includes(resolution)) return error`.
**Effort:** ~15min

---

### 23. [OPEN] No file type validation on upload
**What:** `app/api/upload/confirm/route.ts` accepts any file without checking content-type or extension. Only checks `content-type: image/*` is claimed by the presigned URL flow, but the confirm endpoint doesn't re-validate.
**Why:** A malicious actor could upload non-image files via the presigned URL (if R2 bucket policy isn't locked down).
**Fix:** Re-validate `content-type` on confirm. Only allow `image/jpeg`, `image/png`, `image/heic`, `image/webp`. Reject everything else.
**Effort:** ~30min

---

### 24. [OPEN] Sky replacement swallows errors and still charges
**What:** `app/api/photos/[id]/sky-replace/route.ts:88–92` catches enqueue errors but continues — credits are deducted even if the job was never queued.
**Why:** Users pay for sky replacement that never runs. Silent credit loss.
**Fix:** If BullMQ enqueue fails, do NOT deduct credits. Return the error to the user. Only deduct when the job is successfully queued.
**Effort:** ~30min

---

### 25. [OPEN] Credit deduction not atomic with clip enqueue
**What:** `app/api/clips/generate/route.ts:105–123` deducts credits after successful BullMQ enqueue. These are two separate operations — if credit deduction fails after enqueue succeeds, clip is queued but credits weren't charged.
**Why:** Free clips if the second operation fails.
**Fix:** Wrap both in a transaction, OR deduct credits first and only enqueue if credits were successfully deducted. Use `db.transaction()`.
**Effort:** ~1hr

---

## PILLAR 5: Credit & Pricing Integrity

---

### 26. [DONE] Signup credit mismatch with SPEC ✅
**What:** DB defaults `users.credits = 1000` on signup. SPEC says "$10 free signup credit". At 1250 credits/$ that's 12,500 credits, at 100 credits/$ that's 1,000 credits. Which is correct?
**Why:** Either the DB was wrong, or SPEC was wrong. Users expect $10 worth of credits.
**Decision:** $10 signup credit = 1,000 credits at 100/$. DB was already correct (default 1,000). SPEC.md updated to document this rate explicitly. Package rates remain higher (1,250/$ for standard packages) — see Item 27.
**Effort:** ~15min
**Done:** SPEC.md billing section now states "$10 free signup credit = 1,000 credits (100 credits/$)" explicitly.

---

### 27. [DONE] Credit package math inconsistencies ✅
**What:** `lib/credits.ts` had inconsistent rates:
- Signup bonus used 100 credits/$ (1,000 credits = $10)
- Paid packages used 1,250 credits/$ (e.g., $49 → 200 credits)
- SGD packages used same rate as USD despite ~0.75 SGD/USD exchange rate

**Decision (2026-03-28):** Complete COGS-calibrated pricing restructure:
- **1 credit = $0.25 USD** (not a sliding scale)
- **Signup bonus:** 40 credits = $2.50 (aligned with per-clip price of $2.50)
- **Per-operation costs:** clip_720p=10, clip_1080p=12, clip_4k=16, virtual_staging=5, sky_replacement=2, music_generation=8, auto_edit=2
- **USD packages:** $12.50→50cr, $49→200cr, $149→600cr, $299→1,200cr (all 4 credits/$)
- **SGD packages:** S$17→50cr, S$65→200cr, S$199→600cr, S$399→1,200cr (priced to match USD value, ~0.75 SGD/USD)
- **Stripe fee handling:** Per-transaction fee (2.9%+$0.30) absorbed in price; micro-transactions below $1 discouraged

**Files changed:** `lib/credits.ts` (complete rewrite), `SPEC.md` (billing + credit pricing table), `components/landing/Pricing.tsx` (all packages + per-clip rates + signup CTA), `lib/db/schema.ts` (credits default 1000→40)
**Effort:** ~2hrs

---

## PILLAR 6: Singapore Market

---

### 28. [DONE] CEA number not validated against format ✅
**What:** `cdcNumber` accepts any string up to 50 chars. Real CEA numbers have a known format (e.g., `R012345B`).
**Why:** Invalid CEA numbers displayed on video overlays are embarrassing and potentially legally problematic.
**Fix:** Added in Pillar 4 (Item 21). `PATCH /api/projects/[id]` now validates `cdcNumber` against CEA format `R\d{6}[A-Z]` (max 50 chars). Returns 400 with descriptive error on invalid format.
**Files:** `app/api/projects/[id]/route.ts:74-93`
**Effort:** ~30min

---

### 29. [OPEN] SGD packages not repriced for exchange rate drift
**What:** SGD credit packages use a fixed 1,250 credits/SGD. SGD/USD fluctuates. If SGD weakens, SGD packages become cheaper in USD terms; if SGD strengthens, they become more expensive.
**Why:** Arbitrage opportunity or margin compression.
**Fix:** Consider: (a) periodic repricing of SGD packages, (b) pricing SGD packages at a slight premium to account for volatility, or (c) accepting thefluctuation as a business cost. Document the policy.
**Effort:** ~1hr (decision + doc)

---

### 30. [OPEN] GST not handled on Singapore receipts
**What:** Transactions above S$800 attract 9% GST in Singapore. Stripe checkout doesn't add GST.
**Why:** Non-compliance with IRAS (Inland Revenue Authority of Singapore) for Singapore-registered businesses.
**Fix:** Configure Stripe Tax for Singapore or add GST line item manually for SGD transactions above threshold. Consult an accountant.
**Effort:** ~2hr + accountant review

---

### 31. [OPEN] No localized Singapore support contact
**What:** Legal pages (privacy policy, ToS) have no Singapore phone number, address, or DPO contact as required by PDPA for data-related queries.
**Why:** PDPA requires a Singapore-based contact for data protection queries.
**Fix:** Add to privacy policy and footer: Singapore company address, PDPA contact email, phone number.
**Effort:** ~30min

---

## PILLAR 7: Documentation & Config

---

### 32. [OPEN] `known-issues.md` needs review
**What:** `docs/engineering/known-issues.md` was last reviewed 2026-03-27 and contains 20 items, many of which overlap with this TODOS list.
**Why:** Two sources of truth create drift.
**Fix:** Cross-reference this TODOS.md against `known-issues.md`. De-duplicate. Keep `known-issues.md` as the public-facing short list (for auditors, partners). Keep TODOS.md as the internal engineering backlog.
**Effort:** ~1hr

---

### 33. [OPEN] `deployment.md` references wrong platform
**What:** `docs/engineering/deployment.md` says Railway. The project is built for Vercel.
**Why:** Misleading for anyone following deployment docs.
**Fix:** Update `deployment.md` to reflect Vercel deployment. Or delete it if redundant with other docs.
**Effort:** ~30min

---

### 34. [OPEN] SPEC.md "VuGru Clone" IP reference
**What:** SPEC.md opens with "VuGru Clone". `known-issues.md` flags this.
**Why:** If PropFrame was built by cloning VuGru's design/UX directly, there may be IP implications.
**Fix:** Review all design decisions. Rewrite SPEC.md from PropFrame's own product vision. Ensure no visual/UX copying from VuGru.
**Effort:** ~2hr (legal review + rewrite)

---

## Not Started / Backlog

Items below here are real features but haven't been started and aren't blocking launch.

- Project duplication (re-use photos, generate new clips)
- Bulk photo select + delete
- Multiple session management (log out all devices)
- Credit expiry system (monthly pool expiry)
- Project status: `active | processing | complete` — status transitions not enforced
- Zod env var validation (`env.d.ts`)
- Consistent API error response format (`apiResponse.ts` helper)
- Worker graceful shutdown (Sky Replace worker doesn't close Redis cleanly)
- Worker concurrency not configurable via env var (Sky Replace `concurrency: 2` hardcoded)
- Public share: 7-day expiry not enforced on share tokens
- Social sharing: one-click copy caption + link
- iOS React Native app (SPEC Section 8)

---

## Completed (this session)

- [x] Stripe SGD + PayNow checkout (API + modal)
- [x] Stripe webhook: SGD currency + org credit ledger
- [x] Org credit pool purchase UI (directors can buy pool credits)
- [x] BuyCreditsModal: USD/SGD currency toggle
- [x] SGT timestamps on all user-facing dates
- [x] PDPA privacy policy
- [x] Singapore ToS with CEA compliance
- [x] SGD credit packages (`SGD_CREDIT_PACKAGES`)
- [x] CEA number per project (DB + API + settings modal + clip overlay)
