# VuGru Clone — SPEC.md

## 1. Concept & Vision

**Working Name:** FrameForge (placeholder — pick better name)

AI-powered real estate video generation from listing photos. Upload photos, get cinematic Ken Burns video clips, auto-assembled walkthroughs with AI music and titles. No camera gear, no editing software, no design skills required.

Target user: real estate photographers, agents, brokers. They photograph empty rooms, the platform makes the listing video.

**Personality:** Confident, minimal, professional. Real estate is a high-stakes transaction — the tool should feel premium and trustworthy, not playful. Dark UI with crisp whites, sharp typography. Think: luxury real estate brochure meets modern SaaS.

**North star:** "From photo to listing video in 5 minutes."

---

## 2. Design Language

### Color Palette
- **Primary:** `#0F172A` (slate-950 — deep navy, main background)
- **Secondary:** `#1E293B` (slate-800 — cards, panels)
- **Accent:** `#3B82F6` (blue-500 — primary actions, CTAs)
- **Accent Hover:** `#2563EB` (blue-600)
- **Success:** `#10B981` (emerald-500)
- **Warning:** `#F59E0B` (amber-500)
- **Error:** `#EF4444` (red-500)
- **Text Primary:** `#F8FAFC` (slate-50)
- **Text Secondary:** `#94A3B8` (slate-400)
- **Border:** `#334155` (slate-700)
- **Surface:** `#1E293B` (slate-800)

### Typography
- **Headings:** Inter (700, 600) — clean, authoritative
- **Body:** Inter (400, 500) — highly readable at small sizes
- **Mono/Labels:** JetBrains Mono — for prices, stats, technical labels
- **Scale:** 12 / 14 / 16 / 20 / 24 / 32 / 48 / 64px

### Spacing System
- 4px base unit. Common: 8, 12, 16, 24, 32, 48, 64, 96px
- Section padding: 96px vertical on desktop, 48px mobile
- Card padding: 24px
- Border radius: 8px (cards), 6px (buttons), 4px (inputs)

### Motion Philosophy
- **Entrance:** fade-in + translateY(8px), 300ms ease-out, 80ms stagger between items
- **Hover:** scale(1.02) on cards, brightness shift on buttons, 150ms
- **Page transitions:** opacity fade 200ms
- **Progress indicators:** smooth width transitions, pulse animation on processing
- **Video preview:** Ken Burns motion applied via CSS transform, 8s duration, ease-in-out
- **Loading states:** skeleton shimmer (#1E293B → #334155 gradient sweep)

### Visual Assets
- **Icons:** Lucide React — consistent 24px stroke icons
- **Images:** Unsplash real estate photography for marketing/landing
- **Decorative:** Subtle dot grid pattern on hero (opacity 0.03), gradient mesh backgrounds

---

## 3. Layout & Structure

### Information Architecture

```
/ (Landing)
  → Hero + demo video + CTA
  → Social proof bar (stats)
  → How it works (4 steps)
  → Feature showcase (Auto-Edit, AI Music, Virtual Staging, Sky Replacement)
  → Pricing
  → FAQ
  → Footer

/ai (App — authenticated)
  → Dashboard (project list + stats)
  → /ai/project/[id] (workspace: photos, clips, timeline, export)

/auth
  → /auth/login
  → /auth/signup
  → /auth/forgot-password

/settings
  → Account, Billing, API Keys, Notifications
```

### Landing Page Pacing
1. **Hero** — Full viewport. Dark background. Headline + subheadline + CTA + demo video thumbnail. Minimal.
2. **Social Proof** — Slim bar. "15,000+ clips created • 800+ pros". Just the numbers.
3. **How It Works** — 4 steps, icon + title + description each. Numbered. Light contrast section.
4. **Features** — Alternating left/right feature blocks. Each feature: visual left, text right.
5. **Pricing** — Single card, clear. "Simple dollar pricing". No tiers confusion.
6. **FAQ** — Accordion. 5-6 questions max.
7. **Footer** — Links, social icons, copyright.

### Responsive Strategy
- Mobile-first breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Landing: stacked on mobile, side-by-side on lg+
- App dashboard: sidebar collapses to bottom nav on mobile
- Video preview: 16:9 aspect ratio maintained at all sizes

---

## 4. Features & Interactions

### Core Flow (MVP)

**Photo Upload**
- Drag-and-drop zone or click to browse
- Accepts: JPG, PNG, HEIC, WebP
- Max 50 photos per project
- Max 25MB per photo
- Progress bar per file
- Thumbnail grid preview after upload
- Reorder via drag
- Delete individual or clear all
- Validation: min 1 photo required

**Clip Generation**
- Each photo → 1 clip (5 seconds, MP4)
- Motion style options:
  - Smooth Push-in (default)
  - Slow Zoom Out
  - Pan Left / Pan Right
  - Custom Motion Prompt (text input — "slow rise from floor", "dolly forward")
- Resolution: 720p default, 1080p +$0.20, 4K +$0.80
- Generation time: ~30 seconds per clip (async with polling)
- States per clip: queued → processing → done → error
- Error state: retry button

**Auto-Edit**
- Select 1+ clips to combine
- Drag-and-drop clip arrangement
- Title screen: property address input, font, color
- Music: select from 5 pre-built tracks OR generate custom via AI ($2/song)
- Output: complete MP4 walkthrough
- Duration: sum of clip durations + title duration
- Resolution same as source clips

**Export & Download**
- Download individual clips (ZIP or one-by-one)
- Download auto-edit video
- Copy shareable link (public, expires in 7 days)
- One-click share to social (copy caption + link)

### Secondary Features

**Virtual Staging** (Enhancement tier)
- Click room → AI furnishes it
- Style presets: Modern, Scandinavian, Industrial, Warm
- Before/after slider comparison
- $0.50 per photo

**Sky Replacement** (Enhancement tier)
- Detect sky in exterior photos
- Replace with: Blue Sky, Golden Hour, Twilight
- Custom sky image upload
- $0.50 per photo

**AI Music Generation**
- Input: mood/tempo description ("upbeat, optimistic, soft")
- Output: 60-second ambient track
- Copyright-free for commercial use
- $2 per generation

### User Accounts
- Email + password signup/login
- Magic link option (passwordless)
- OAuth: Google
- Password reset via email
- Session: JWT stored in httpOnly cookie
- Multi-device: unlimited sessions

### Billing (Stripe)
- Credits system: buy credits, deduct per operation
- $10 free signup credit
- Credit packages: $20 (250 credits), $50 (625 credits), $100 (1300 credits)
- No subscription. Pay-as-you-go only.
- Stripe Checkout for payment
- Webhook handling: credit top-up on successful payment
- Invoice history in settings

### Project Management
- Projects table: name, created date, clip count, status
- Rename project
- Duplicate project (re-use same photos, generate new clips)
- Delete project
- Bulk select + delete

---

## 5. Component Inventory

### Buttons
- **Primary:** Blue-500 bg, white text, 6px radius, 150ms hover brightness, 500ms press scale(0.98)
- **Secondary:** Transparent, slate border, slate text, hover: slate-700 bg
- **Ghost:** No border, slate-400 text, hover: slate-800 bg
- **Danger:** Red-500 bg for destructive actions
- **States:** loading (spinner replaces text), disabled (opacity 0.5, no pointer)

### Input Fields
- Dark surface (#1E293B), slate border, white text, 6px radius
- Focus: blue-500 ring (2px)
- Error: red-500 ring + error message below
- Labels above, helper text below in slate-400

### Cards
- #1E293B bg, #334155 border, 8px radius, 24px padding
- Hover (if clickable): translateY(-2px), subtle shadow

### Photo Thumbnail
- 1:1 aspect ratio, object-cover
- Selected state: blue-500 ring
- Processing state: shimmer overlay + spinner
- Error state: red tint + retry icon
- Hover: scale(1.03)

### Clip Card
- 16:9 thumbnail preview (animated Ken Burns on hover)
- Duration badge (bottom right)
- Status badge: Processing (amber pulse), Done (green), Error (red)
- Hover: play icon overlay, scale(1.02)

### Modal / Dialog
- Backdrop blur + dark overlay
- Centered, max-w-lg, 8px radius
- Header with title + close X
- Body
- Footer with action buttons (right-aligned)
- Escape to close, click outside to close

### Toast Notifications
- Bottom-right stack
- Auto-dismiss 5s (info/success), 8s (warning/error)
- Types: success (green), error (red), warning (amber), info (blue)
- Dismiss button

### Progress Bar
- Thin (4px), rounded
- Animated fill, shimmer on indeterminate

### Skeleton Loader
- Matches component shape
- Shimmer: #1E293B → #334155 → #1E293B sweep, 1.5s infinite

---

## 6. Technical Approach

### Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes (Edge Runtime where possible)
- **Database:** PostgreSQL via Supabase (auth + data)
- **Storage:** Cloudflare R2 for photos/videos (S3-compatible)
- **Video Processing:** FFmpeg WASM (browser-side for previews) + server-side FFmpeg for final render
- **AI/ML:**
  - Clip motion: Replicate.com API (Kosmos/Sana/DepthFM for image-to-video)
  - Virtual staging: Replicate API or OpenAI Vision
  - Sky replacement: Remove.bg + custom blend
  - AI music: Suno API or Replicate MusicGen
- **Payments:** Stripe (Checkout + Webhooks)
- **Email:** Resend (transactional: auth, receipts)
- **Deployment:** Vercel (frontend) + dedicated GPU worker (video rendering)
- **iOS:** React Native (Expo) sharing as much code as possible with web

### Architecture

```
app/
  (marketing)/
    page.tsx           — Landing page
    pricing/
    blog/
  (app)/
    layout.tsx         — App shell (sidebar, nav)
    dashboard/
    project/[id]/
  (auth)/
    login/
    signup/
    forgot-password/
  api/
    auth/
    projects/
    clips/
    upload/
    billing/
    webhooks/stripe/

components/
  ui/                  — Primitives (Button, Input, Card, Modal)
  landing/             — Landing page sections
  dashboard/           — Project list, stats
  editor/              — Photo grid, clip timeline, export
  billing/             — Credit display, purchase modal

lib/
  supabase.ts          — Supabase client
  stripe.ts             — Stripe client + helpers
  replicate.ts          — AI API client
  ffmpeg.ts             — FFmpeg wrapper
  r2.ts                 — Cloudflare R2 client
  credits.ts            — Credit calculation helpers

workers/
  video-render/         — GPU worker for clip generation
```

### API Design

**Projects**
- `POST /api/projects` — Create project
- `GET /api/projects` — List user projects
- `GET /api/projects/[id]` — Get project + clips
- `PATCH /api/projects/[id]` — Update project (name)
- `DELETE /api/projects/[id]` — Delete project

**Clips**
- `POST /api/clips/generate` — Queue clip generation job
- `GET /api/clips/[id]` — Get clip + status
- `GET /api/clips/[id]/download` — Signed download URL

**Upload**
- `POST /api/upload/presign` — Get presigned R2 URL for direct upload
- `POST /api/upload/confirm` — Confirm upload, create DB record

**Billing**
- `POST /api/billing/checkout` — Create Stripe Checkout session
- `POST /api/webhooks/stripe` — Handle payment events
- `GET /api/billing/credits` — Get current credit balance

### Data Model

```typescript
// User — managed by Supabase Auth

Project {
  id: uuid
  user_id: uuid
  name: string
  status: 'active' | 'processing' | 'complete'
  clip_count: int
  created_at: timestamp
  updated_at: timestamp
}

Photo {
  id: uuid
  project_id: uuid
  storage_key: string       // R2 path
  width: int
  height: int
  order: int
  virtual_staged: boolean
  sky_replaced: boolean
  created_at: timestamp
}

Clip {
  id: uuid
  project_id: uuid
  photo_id: uuid
  storage_key: string       // R2 path
  motion_style: string       // 'push-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'custom'
  custom_prompt: string?
  resolution: '720p' | '1080p' | '4k'
  duration: float            // seconds
  status: 'queued' | 'processing' | 'done' | 'error'
  error_message: string?
  cost: int                  // credits
  created_at: timestamp
}

CreditTransaction {
  id: uuid
  user_id: uuid
  amount: int                // positive = credit, negative = debit
  type: 'signup' | 'purchase' | 'clip_generation' | 'virtual_staging' | 'sky_replacement' | 'music_generation'
  reference_id: uuid?        // clip_id, photo_id etc
  created_at: timestamp
}

AutoEdit {
  id: uuid
  project_id: uuid
  storage_key: string
  clip_ids: uuid[]
  title_text: string
  music_key: string?
  duration: float
  status: 'draft' | 'rendering' | 'done'
  cost: int
  created_at: timestamp
}
```

### Credit Pricing
| Operation | Credits |
|---|---|
| Clip 720p | 1 credit |
| Clip 1080p | 2 credits |
| Clip 4K | 4 credits |
| Auto-Edit assembly | 1 credit |
| Virtual Staging | 1 credit/photo |
| Sky Replacement | 1 credit/photo |
| AI Music (60s) | 2 credits |

### Authentication Flow
1. User submits email → magic link sent via Resend
2. User clicks link → redirected to /auth/callback → JWT issued
3. JWT in httpOnly cookie, 7-day expiry, refreshed on activity
4. Middleware checks cookie on all /ai/* routes

### Video Processing Pipeline
1. User uploads photos → direct to R2 via presigned URL
2. Frontend calls `POST /api/clips/generate` for each photo
3. API queues job, returns `clip_id` with `status: queued`
4. GPU worker polls queue, picks up job:
   - Downloads photo from R2
   - Calls Replicate API for motion generation
   - Downloads generated video from Replicate
   - Uploads to R2
   - Updates DB: `status: done`, `storage_key`
5. Frontend polls `GET /api/clips/[id]` every 3s
6. When all clips done → user can proceed to Auto-Edit

---

## 7. Compound Engineering Setup

This project uses the compound engineering workflow. All major work goes through the `/ce:plan` → `/ce:work` → `/ce:review` pipeline.

### Project-specific Skills

```
.skills/
  vugru-ideate.md       — Divergent ideation for real estate video
  vugru-plan.md         — Planning grounded in Next.js + Supabase patterns
  vugru-work.md         — Execution with frontend/backend separation
  vugru-review.md       — Review: UX fidelity, API correctness, cost safety
```

### Key Conventions
- Feature branches: `feat/<feature-name>`, `fix/<bug-name>`
- PRs required for all changes — reviewed via `/ce:review`
- All secrets in `.env.local`, never committed
- `bun` used as package manager (matches compound-engineering repo)

---

## 8. iOS App Scope

The React Native app shares the API layer and business logic. Only the shell and UI layer are native.

### Shared (via workspace packages)
- All API clients (Supabase, Stripe, R2)
- Credit logic, pricing constants
- Project/clip data models
- Auto-edit composition logic

### Native (iOS)
- App shell: tab navigation (Dashboard, New Project, Settings)
- Camera roll picker for photo selection
- Native video player for clip preview
- Background upload for photos
- Push notifications (generation complete)
- FaceID/TouchID for authentication

### Out of Scope for v1
- Actual video editing (timeline, trimming)
- Virtual staging in-app (can view results)
- In-app credit purchase

---

## 9. Out of Scope for Web v1

- Mobile-responsive video editor (clip trimming, overlays)
- White-label / embeddable widget
- Team collaboration (multi-user projects)
- MLS integration
- Zillow/Realtor.com direct syndication
