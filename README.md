# PropFrame

AI-powered real estate video generation from listing photos. Upload photos, get cinematic Ken Burns video clips, auto-assembled walkthroughs with AI music and titles.

## What it does

1. **Upload** listing photos to a project
2. **Generate clips** — each photo becomes a cinematic video clip via Runway Gen-3 + SVD
3. **Auto-edit** — clips assembled into a full walkthrough with titles and AI music
4. **Download** — final MP4 delivered via Cloudflare R2 CDN

## Quick start

```bash
npm install
npm run dev
```

See [docs/engineering/setup.md](./docs/engineering/setup.md) for full setup instructions.

## Tech stack

| Layer | Technology |
|---|---|
| App | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT sessions (magic link) |
| Storage | Cloudflare R2 (presigned URLs) |
| Billing | Stripe (credit packs, SGD + USD) |
| AI video | Runway Gen-3 Alpha Turbo, Stable Video Diffusion |
| Virtual staging | Segment Anything 2 |
| Worker | BullMQ + Redis |
| Rate limiting | Upstash Redis |
| Deployment | Vercel (Next.js) + Railway (workers) |

## Key features

- **Credit system** — Starter ($12.50/50 credits) through Team ($299/1,200 credits)
- **SGD pricing** — Singapore market with GST-exempt pricing
- **Org billing** — Team credit pools with member management
- **Virtual staging** — Sky replacement, virtual furniture placement
- **Stripe billing portal** — Self-serve invoice and subscription management

## Project structure

```
app/                    # Next.js App Router pages + API routes
  (app)/               # Authenticated app routes
    dashboard/         # Project grid
    project/[id]/     # Project detail (photos, clips, auto-edit)
    settings/         # Account + billing settings
    org/[id]/         # Org dashboard
  (auth)/              # Login, signup, invite acceptance
  api/
    auth/             # Login, signup, token verify
    billing/          # Checkout, portal, credits, history
    clips/            # Generate, status, download
    projects/         # CRUD, photos, reorder
    organizations/     # Org management
    webhooks/stripe/  # Stripe webhook handler
    cron/             # Scheduled cleanup jobs
components/            # React components
  editor/             # PhotoUploader, ClipGrid, VideoModal
  billing/            # BuyCreditsModal
  landing/            # Landing page components
  org/                # Org settings components
lib/
  db/                 # Drizzle schema + queries
  auth/               # JWT verify, session helpers
  credits.ts          # Credit costs + formatting
  ratelimit.ts        # Redis-backed rate limiting
  circuitBreaker.ts   # opossum circuit breaker for Runway API
  music.ts            # Music track constants
workers/
  video-render/        # BullMQ worker for clip generation
  virtual-stage/       # BullMQ worker for sky replacement + virtual staging
```

## Documentation

- [Quickstart](./docs/engineering/setup.md)
- [Deployment](./docs/engineering/deployment.md)
- [API Reference](./docs/engineering/api-reference.md)
- [Known Issues](./docs/engineering/known-issues.md)
- [Architecture](./docs/research/architecture.md)
- [AI Model Research](./docs/research/models.md)
- [Roadmap](./docs/roadmap/v1.md)

## Environment variables

See `.env.local.example` for required variables. Key variables:

```
DATABASE_URL           # PostgreSQL connection string
NEXTAUTH_SECRET        # JWT signing secret
STRIPE_SECRET_KEY       # Stripe API key
STRIPE_WEBHOOK_SECRET   # Stripe webhook signing secret
UPSTASH_REDIS_REST_URL # Redis for BullMQ + rate limiting
UPSTASH_REDIS_REST_TOKEN
REPLICATE_API_TOKEN    # Runway/SVD video generation
```

## Packages to install

```bash
npm install @upstash/ratelimit @upstash/redis opossum
```
