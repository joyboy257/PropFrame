# Setup — Local Development

## Prerequisites

- Node.js 20+
- pnpm (or npm)
- Git

## 1. Clone and install

```bash
git clone https://github.com/joyboy257/vugru-clone.git
cd vugru-clone
pnpm install
```

## 2. Environment variables

Copy the example files and fill in your values:

```bash
cp .env.example .env.local
cd gpu-worker && cp .env.example .env && cd ..
```

### Required variables

**App (.env.local):**
```
DATABASE_URL=postgresql://postgres:password@host:5432/railway
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=http://localhost:3000

# Cloudflare R2 (optional for local dev)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=vugru-media
NEXT_PUBLIC_R2_PUBLIC_URL=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Groq (AI text)
GROQ_API_KEY=

# Cohere (AI vision)
COHERE_API_KEY=
```

**GPU Worker (.env):**
```
DATABASE_URL=postgresql://postgres:password@host:5432/railway
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=vugru-media
R2_PUBLIC_URL=
VIDEO_MODEL_API_URL=
VIDEO_MODEL_API_KEY=
POLL_INTERVAL_MS=3000
```

## 3. Database

Apply the schema (Railway already has this running):

```bash
# Using psql directly
psql $DATABASE_URL -f supabase/migrations/001_schema.sql
```

Or run the app — Drizzle will sync on boot if `ENABLE_DB_PUSH=true` is set.

## 4. Run

```bash
# App (Next.js dev server)
pnpm dev

# GPU worker (separate terminal)
cd gpu-worker && pnpm dev
```

App runs at `http://localhost:3000`.

## 5. Verify

```bash
# App builds without errors
pnpm build

# GPU worker compiles
cd gpu-worker && npx tsc --noEmit
```

## Troubleshooting

**`Connection refused` on DATABASE_URL**
Railway's internal URL (`postgres.railway.internal`) only works from within Railway's network. For local dev, use the `DATABASE_PUBLIC_URL` instead.

**R2 uploads fail locally**
Uploads require valid R2 credentials. Without them, the app falls back to a mock URL — uploads won't persist but the flow works.

**Stripe webhook won't fire locally**
Use `stripe listen --forward-to localhost:3000/webhooks/stripe` to proxy webhooks to your local machine.
