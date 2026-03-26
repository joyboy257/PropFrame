# Model Research — Free Tier Landscape

> Date: 2026-03-26
> Status: Active research — revisit quarterly as pricing shifts

---

## TL;DR

| Use case | Recommended free tier | Fallback |
|---|---|---|
| LLM text generation | Groq Llama 3.3 70B | Cohere Command R+ |
| Vision / image understanding | Cohere Command R+ Vision | OpenAI GPT-4o (paid) |
| Video generation | Together.ai ($5 free credit) | Self-host / pay-as-you-go |
| Image generation | Together.ai FLUX | Replicate (paid) |

**Video generation has no permanent free tier at scale.** Budget for it.

---

## Provider Breakdown

### Groq — Fastest free tier, text only

**Strengths:** Fastest inference (~280-560 tokens/sec), OpenAI-compatible API, generous rate limits on free tier.

**Free tier limits:**
- Llama 3.1 8B: 250K TPM, 1K RPM
- Llama 3.3 70B: 300K TPM, 1K RPM
- Mistral 8x7B: similar limits

**Limitations:**
- No vision models
- No audio/video models
- Rate limits can be hit hard at production scale

**Use for:** Title text generation, clip naming, auto-edit scripting, any LLM call in the pipeline.

**API shape (OpenAI-compatible):**
```typescript
const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: 'Generate a cinematic title for a real estate video...' }],
  }),
});
```

---

### Cohere — Best free vision, strong text

**Strengths:** Best free vision model (`command-r-plus-vision`), large context windows, strong text reasoning.

**Free tier:**
- Command R+: 1M tokens/month free
- Command R+ Vision: separate quota, check dashboard

**Limitations:**
- Not OpenAI-compatible — uses Cohere's own SDK
- Free quotas reset monthly, no rollover

**Use for:**
- Analyzing listing photos for virtual staging prompts
- Sky replacement quality checks
- Describing rooms for auto-edit title generation

**API shape:**
```typescript
import { CohereClient } from 'cohere-ai';
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
const response = await cohere.chat({
  model: 'command-r-plus-vision',
  messages: [{ role: 'user', content: 'Describe this room in detail for virtual staging...' }],
});
```

---

### Together.ai — Most model variety, free credits

**Strengths:** Hosts nearly every open model including FLUX (image gen), video models, Llama, Qwen, DeepSeek.

**Free tier:** $5 credits on signup. No permanent free tier after that.

**Use for:**
- Video generation (no free option elsewhere)
- Image generation with FLUX
- Experimentation with different model families

**Watch out:** $5 goes fast with video. A handful of video generations at 720p will burn through it.

---

### GitHub Models — Free, dev/traffic limits

**Strengths:** GPT-4o, o1, Phi-4 all free. Azure-backed reliability.

**Limitations:** Licensed for development and internal use only — not for public-facing production traffic.

**Use for:** Internal tooling, prototyping, testing. Not suitable for the public PropFrame API.

---

## PropFrame Integration Plan

### Phase 1 — Immediate (free only)
- [ ] Groq API for title generation, clip naming, prompt augmentation
- [ ] Cohere Vision for photo analysis (staging/sky replacement)
- [ ] Ken Burns via ffmpeg (zero cost, works today)

### Phase 2 — Video generation
- [ ] Together.ai FLUX for image generation (first $5 credit)
- [ ] Together.ai video model (separate budget needed)
- [ ] Alternative: Modal.com GPU worker with self-hosted model

### Phase 3 — Scale
- [ ] Evaluate Groq production tier vs self-hosted Llama on Modal/GPU cloud
- [ ] Add Cohere Vision to production stack if free tier insufficient

---

## Open Questions

1. **What video model should we target?** RunPod serverless? Replicate? Modal GPU?
2. **Does Cohere Vision handle architectural/real estate imagery well?** Need a test set.
3. **Groq rate limits** — at what traffic level do we hit the 1K RPM ceiling?
4. **Virtual staging quality** — can Cohere Vision + a prompt actually produce usable staging descriptions, or do we need image-to-image generation?

---

## Appendix: All Free Tiers Tested

| Provider | Text LLM | Vision | Video | Audio | Free limits |
|---|---|---|---|---|---|
| Groq | Yes (Llama 3.1/3.3, Mistral) | No | No | No | 250-300K TPM |
| Cohere | Yes (Command R+) | Yes (Vision) | No | No | 1M tokens/mo |
| Together.ai | Yes (many) | Yes (FLUX) | Yes (trial credits) | No | $5 signup |
| GitHub Models | Yes (GPT-4o, Phi-4) | Yes (GPT-4o) | No | No | Dev/internal only |
| OpenAI | Yes (4o mini) | Yes (4o) | No | Yes | $5 free credit |
| Lepton AI | Yes (Llama, Qwen) | No | No | No | Generous free tier |
| Anyscale | Yes (open models) | No | No | No | Free tier available |
| Perplexity | Yes (Sonar) | No | No | No | API free tier |
| Groq (Compound) | Yes (with tools) | Partial | No | No | ~450 tps |
