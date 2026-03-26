# Architecture Decisions

> Status: In progress. Last updated 2026-03-26.

---

## DB: Railway PostgreSQL (decided)

**Decision:** Use Railway's PostgreSQL for all persistent data.

**Rationale:**
- Already provisioned with internal + public URLs
- PG is the default path from Supabase/drizzle-orm setup
- Railway private networking means the DB isn't exposed publicly
- Internal URL works from Railway's GPU worker host

**Open questions:**
- Should we add a read replica for the GPU worker to avoid competing with the app?
- Connection pooling: current pool is max 10 connections. Revisit when traffic grows.

---

## Auth: JWT sessions via magic link (decided)

**Decision:** Email magic link → JWT stored in httpOnly cookie.

**Rationale:**
- No passwords to hash or leak
- Works for users who don't want to create accounts
- JWT eliminates server-side session store

**Session lifecycle:**
- Login: magic link emailed, contains signed JWT
- JWT validated on every protected route via middleware
- Sessions table exists for invalidation (future: revoke compromised tokens)

**Open questions:**
- Refresh token rotation not implemented yet
- No rate limiting on magic link email (spam/abuse vector)

---

## Storage: Cloudflare R2 (decided)

**Decision:** All user uploads (photos) and generated files (clips) stored in R2.

**Rationale:**
- S3-compatible, works with `@aws-sdk/client-s3`
- R2's public URL + custom domain for serving clips
- Cheaper than S3 at scale
- Presigned URLs keep uploads directly from browser → R2, never through the app server

**Open questions:**
- R2 bucket lifecycle policies not configured (auto-delete old clips?)
- CDN caching layer in front of R2 public URLs?

---

## File Processing: GPU Worker (decided)

**Decision:** Standalone Node.js process polls the DB for `status=queued` clips.

**Rationale:**
- Keeps AI/ffmpeg load off the Next.js app server
- Railway is CPU-optimized; Next.js runs fine there
- Polling is simple and survives restarts (idempotent)
- Alternative (Queue services) adds cost and complexity

**Processing flow:** (see `gpu-worker/src/index.ts`)

**Open questions:**
- Should the worker auto-scale to multiple instances? Need a lock (DB row) to avoid double-processing.
- Currently no dead-letter queue for failed jobs after max retries.

---

## AI Integration: Groq + Cohere (decided — Phase 1)

**Decision:**
- Groq Llama 3.3 70B for all text LLM tasks
- Cohere Command R+ Vision for photo understanding

**Rationale:**
- Both have generous free tiers
- Groq is the fastest inference available at any price
- Cohere Vision is the best free vision model for real estate/architectural imagery

**Open questions:**
- At what traffic level do we exceed Groq's 1K RPM limit?
- Should we add response caching for repeated LLM calls on the same clip?
