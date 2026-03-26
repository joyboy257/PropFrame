# Architecture Decisions

> Status: In progress. Last updated 2026-03-26.

---

## DB: Railway PostgreSQL (decided)

**Decision:** Use Railway's PostgreSQL for all persistent data.

**Rationale:**
- Already provisioned with internal + public URLs
- PG is the default path from Supabase/drizzle-orm setup
- Railway private networking keeps the DB off the public internet
- Internal URL works from Railway GPU worker host

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
- Should the worker auto-scale to multiple instances? Need a DB lock to avoid double-processing.
- No dead-letter queue for failed jobs after max retries.

---

## AI Integration (decided — Phase 1)

### Text LLM
**Groq Llama 3.3 70B** — fastest inference available, generous free tier.

### Vision
**Cohere Command R+ Vision** — best free vision model for real estate/architectural imagery.

### Video Generation
**RunwayML Gen-3 API** — best camera control for real estate, 125 free credits.

**Pipeline:**
- Worker polls `clips` WHERE `status='queued'`
- Calls Runway API → stores `job_id` in `clips.job_id`, sets `status='processing'`
- Polls Runway API every 30s
- On completion: downloads video, uploads to R2, sets `status='done'` + `public_url`

**Provider interface** (`gpu-worker/src/providers/index.ts`):
```typescript
interface VideoProvider {
  generate(opts: { imageUrl: string; prompt: string }): Promise<{ jobId: string }>;
  poll(jobId: string): Promise<'pending' | 'done' | 'error'>;
  download(jobId: string): Promise<Buffer>;
}
```

**Open questions:**
- Webhook vs polling for job completion (webhooks more efficient but add complexity)
- At what traffic level do we exceed Runway's rate limits?
- Should we cache Runway responses for identical clip requests?

### Self-Hosted (Phase 3)
**CogVideoX-2B** on Modal/Lambda — when model quality improves enough, deploy as free tier.

### Supporting Pipeline
- **Real-ESRGAN** — upscaling before clip generation (listing photos are often low quality)
- **Stable Diffusion + ControlNet** — virtual staging (future)
- **SAM + compositing** — sky replacement (future)
