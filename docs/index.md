# PropFrame

AI-powered real estate video generation from listing photos. Upload photos, get cinematic Ken Burns video clips, auto-assembled walkthroughs with AI music and titles.

## Docs

- [Quickstart](./engineering/setup.md) — local dev setup
- [Deployment](./engineering/deployment.md) — Railway + R2 + GPU worker
- [API Reference](./engineering/api-reference.md)
- [AI Model Research](./research/models.md)
- [Architecture](./research/architecture.md)
- [Roadmap](./roadmap/v1.md)

## What this is

PropFrame takes a real estate listing's photos and transforms them into marketing video content:

1. **Upload** listing photos to a project
2. **Generate clips** — each photo becomes a cinematic Ken Burns video clip
3. **Auto-edit** — clips assembled into a full walkthrough with titles and AI-generated music
4. **Download** — final MP4 delivered via R2 CDN

## Tech stack

| Layer | Technology |
|---|---|
| App | Next.js 14 (App Router) |
| Database | Railway PostgreSQL + Drizzle ORM |
| Auth | Email magic link + JWT |
| Storage | Cloudflare R2 (presigned URLs) |
| Billing | Stripe (credits system) |
| AI text | Groq Llama 3.3 70B |
| AI vision | Cohere Command R+ Vision |
| Video | ffmpeg (Ken Burns) + AI video model (TBD) |
| Worker | Standalone Node.js poller |

## Project structure

```
vugru-clone/
├── app/                  # Next.js App Router pages + API routes
│   ├── (app)/            # Authenticated app routes
│   │   ├── dashboard/   # Project grid
│   │   └── project/[id]/ # Project detail (photos, clips, auto-edit)
│   ├── (auth)/           # Login/signup
│   └── api/              # REST API
│       ├── auth/
│       ├── billing/
│       ├── clips/
│       ├── projects/
│       └── upload/
├── components/           # Shared React components
│   ├── editor/           # PhotoUploader, ClipGrid
│   └── ui/               # Button, Input, Modal
├── lib/
│   ├── db/               # Drizzle schema + client
│   ├── auth.ts           # JWT verify, session helpers
│   ├── credits.ts        # Credit costs + formatting
│   └── r2.ts             # R2 presigned URL helpers
├── gpu-worker/           # Standalone clip generation worker
│   └── src/
│       ├── index.ts      # Poll loop
│       ├── clipProcessor.ts  # Ken Burns + AI hook
│       ├── r2.ts         # R2 fetch/upload
│       └── db.ts         # Worker DB connection
└── docs/                 # This documentation
```
