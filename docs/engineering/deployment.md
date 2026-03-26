# Deployment — Railway + R2

## Architecture

```
Browser                    Railway                    R2
   |                           |                        |
   |-- presign request ----->  |                        |
   |<-- presigned URL -------- |                        |
   |                           |                        |
   |-- upload photo -----------+----------------------> |
   |                           |                        |
   |-- generate clip ------->  |                        |
   |<-- job queued ----------  |                        |
   |                           |                        |
   |                      GPU Worker                   |
   |                      (Railway host)              |
   |                           |                        |
   |                      poll DB                      |
   |                           |                        |
   |                      download photo ------------- |
   |                      process (ffmpeg)             |
   |                           |                        |
   |                      upload clip ---------------- |
   |                           |                        |
   |-- poll status --------->  |                        |
   |<-- public URL ------------ |                        |
   |                           |                        |
   |-- download clip --------------------------------> |
```

## Railway Services

You'll need two Railway services:

### 1. Web (Next.js app)

**Start command:** `pnpm start`  
**Health check:** `/api/health` (or similar)

**Environment variables:**
```
DATABASE_URL=postgresql://postgres:...@postgres.railway.internal:5432/railway
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://your-domain.com
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=vugru-media
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub.your-r2-domain.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
GROQ_API_KEY=...
COHERE_API_KEY=...
```

### 2. GPU Worker

**Start command:** `cd gpu-worker && pnpm start`  
**Health check:** not required (polling process, not HTTP)

**Environment variables:**
```
DATABASE_URL=postgresql://postgres:...@postgres.railway.internal:5432/railway
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=vugru-media
R2_PUBLIC_URL=https://pub.your-r2-domain.com
VIDEO_MODEL_API_URL=https://api.provider.com/v1/...
VIDEO_MODEL_API_KEY=...
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
POLL_INTERVAL_MS=3000
LOG_LEVEL=info
```

> Note: Install ffmpeg via Railway's ` Nixpacks` or a custom Dockerfile on the GPU worker service.

## R2 Setup

1. Create a bucket: `vugru-media`
2. Set public access or configure a custom domain with a CDN
3. Add `R2_PUBLIC_URL` to both services

## Stripe Webhook

In Railway web service, configure the Stripe webhook endpoint:
`https://your-domain.com/api/webhooks/stripe`

Events required:
- `checkout.session.completed`
- `payment_intent.payment_failed`

## SSL

Railway handles SSL termination automatically. No nginx/Caddy needed.

## Logs

```bash
# Web logs
railway logs --service web

# Worker logs
railway logs --service gpu-worker
```

## Rollback

Railway deploys are immutable. To rollback:
```bash
railway rollback --deployment <deployment-id>
```
