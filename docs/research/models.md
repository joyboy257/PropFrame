# AI Model Research — Video Generation for PropFrame

> Status: Complete. Last updated 2026-03-26.

---

## The Core Question

PropFrame needs to turn listing photos into cinematic video clips. Current state: ffmpeg Ken Burns (a mechanical zoom/pan — placeholder). Real question: what replaces it?

The use case is narrow: a room photo → realistic, subtle, property-marketing clip. Not a general-purpose movie generator. That narrowness shapes which models matter.

---

## Option A — Commercial APIs

Best for: shipping fast, no GPU infrastructure, accepting per-clip costs.

### The Field

| Provider | Free tier | I2V | Max dur | Latency | Notes |
|---|---|---|---|---|---|
| **OpenAI Sora** | $5 credits | Yes | 20s | 1-3 min | Best quality, most expensive |
| **RunwayML** | 125 credits | Yes | 10s | 30s-2 min | Best camera control, industry standard |
| **Stable Video** | 100 frames/yr | Yes | ~4s | 30s-1 min | Cheapest per-frame, subtle motion |
| **Luma AI** | Limited | Yes | 10s | 1-2 min | Photorealistic, good for luxury |
| **Kling** | Limited | Yes | 30s | 1-3 min | Longer clips, competitive pricing |
| **Pika 2.0** | Free tier | Yes | 10s | ~1 min | Beta API |

### Decision: RunwayML first

Best camera control for real estate — you guide dolly/pan direction via text prompts. 125 free credits is enough to build and test the full integration flow. Quality is strong.

SVD (Stable Video Diffusion) as the cost-option fallback once credits run out.

### Integration Architecture

The `clips.job_id` field in the schema is already in place for async API jobs. Pipeline:

```
Worker polls clips WHERE status='queued'
  → Worker calls provider API with photo URL
  → API returns job_id immediately (status='processing')
  → Worker stores job_id in clips.job_id
  → Worker polls provider API / uses webhook every 30s
  → On completion: download video, upload to R2, set status='done'
  → On failure/timeout: status='error'
```

Provider-agnostic interface in `gpu-worker/src/providers/`:

```typescript
interface VideoProvider {
  generate(opts: { imageUrl: string; prompt: string; duration: number }): Promise<{ jobId: string }>;
  poll(jobId: string): Promise<'pending' | 'done' | 'error'>;
  download(jobId: string): Promise<Buffer>;
}
```

---

## Option B — Self-Hosted (Open Source)

Best for: no per-clip costs, running on your own GPU hardware.

### The Field (ranked by viability)

**1. CogVideoX-2B** — THUDM/CogVideo on HuggingFace
- Image-to-video, Apache 2.0, **4GB VRAM minimum** (runs on a GTX 1080TI)
- 6-second output at 720×480 — lower than ideal for professional use
- Most accessible self-hosted option; realistic to run on a $200 GPU
- HF: `THUDM/CogVideoX-2B-I2V`

**2. Stable Video Diffusion — SVD** (Stability AI)
- Image-to-video, 12-16GB VRAM for full quality
- 14-25 frames output (~2.5-4s) — shorter than ideal
- Purpose-built for photo animation; smooth realistic motion
- HF: `stabilityai/stable-video-diffusion-img2vid`

**3. AnimateDiff + Realistic Vision + ControlNet**
- Image-to-video with photorealistic SDXL base
- 8-12GB VRAM
- Realistic Vision is fine-tuned for architectural photography
- More flexible but more complex to tune

**4. I2VGen-XL** — damo-vilab/i2vgen-xl
- 1280×720 output, A10 GPU (~24GB) required
- CC-BY-NC-ND license — **not commercial use**

### Honest Assessment

None of these produce output at the quality bar for professional real estate marketing today. CogVideoX outputs at 720×480. SVD is 2-4 seconds. AnimateDiff can produce unnatural motion on architectural content.

**These are viable as a free tier fallback** — unlimited free clips while API providers handle high-quality paid tier. Not as the primary path until models improve (expected mid-2026).

---

## Supporting Stack — Upscaling, Staging, Sky

Separate pipeline steps from clip generation.

### Upscaling low-quality listing photos

| Model | Repo | Use case | VRAM |
|---|---|---|---|
| Real-ESRGAN | `xinntao/Real-ESRGAN` | Deblur, JPEG artifacts, 4× upscale | CPU/GPU |
| SwinIR | `JingyunLiang/SwinIR` | Heavy degradation | GPU |
| NMKD Siax | GUI wrapper | Simpler deploy | CPU |

Real-ESRGAN is the first pick — handles the most common listing photo problems (phone camera quality, JPEG compression).

### Virtual staging (empty room → furnished)

Stable Diffusion + ControlNet Depth is the standard open-source approach — depth map preserves room layout while inpainting furniture.

No dedicated open model specifically for staging at commercial quality exists. Proprietary tools (Boxed.com, Staging AI) use custom fine-tuned models.

### Sky replacement

No confirmed open-source model with a live link (SkyFixer returned 404). Segmentation + compositing approach: segment sky with SAM, replace with a sky image library, feather edges.

HF: `wpexperts/sky-replacement` — worth checking.

---

## Decision Summary

| Phase | What | Why |
|---|---|---|
| **Now** | Wire RunwayML API into worker | 125 free credits, best camera control, ships fast |
| **Phase 2** | Add Stable Video as paid fallback | Cheaper per frame, subtle motion |
| **Phase 3** | CogVideoX-2B on Modal/Lambda as free tier | No per-clip cost, improving rapidly |
| **Supporting** | Real-ESRGAN upscaling pipeline | Listing photos are often low quality |
| **Future** | Virtual staging + sky replacement | Separate pipeline steps, not in clip worker |

---

## Official Links

- RunwayML: https://docs.runwayml.com/
- OpenAI Sora: https://platform.openai.com/docs/guides/video-generation
- Stable Video: https://platform.stability.ai/
- Luma AI: https://lumalabs.ai/developers
- CogVideoX: https://huggingface.co/THUDM/CogVideoX-2B-I2V
- Real-ESRGAN: https://github.com/xinntao/Real-ESRGAN
- SwinIR: https://github.com/JingyunLiang/SwinIR
