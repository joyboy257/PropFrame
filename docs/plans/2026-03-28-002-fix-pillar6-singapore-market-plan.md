---
title: Pillar 6 — Singapore Market Compliance
type: fix
status: completed
date: 2026-03-28
deepened: 2026-03-28
---

# Pillar 6 — Singapore Market Compliance

## Overview

Fix three Singapore market compliance gaps: (29) document SGD pricing exchange rate policy, (30) document GST exemption policy for SGD transactions, and (31) add PDPA-required contact details to legal pages.

## Problem Frame

PropFrame sells SGD credit packs but has: no documented exchange rate policy (Item 29), no GST handling documented (Item 30 — user confirmed below S$1M revenue = no GST obligation yet), and legal pages lack a Singapore postal address and phone number as required by PDPA (Item 31).

## Requirements Trace

- R1. SPEC.md documents the SGD exchange rate assumption and volatility policy
- R2. SGD checkout sessions document that GST does not apply at current revenue level
- R3. Privacy policy, ToS, and footer include a Singapore postal address and phone number

## Scope Boundaries

- No Stripe Tax activation — user is below S$1M revenue threshold, GST does not apply yet
- No CEA regulatory guidance beyond what's already in ToS (Item 28 covered validation)
- No changes to credit pack prices — already set in Item 27

## Key Technical Decisions

- **Item 29 is documentation-only** — SGD pricing was already implemented in the Item 27 pricing restructure. SPEC.md needs a new SGD subsection and the credit packages bullet should become a table.
- **Item 30: GST exemption** — PropFrame is below the S$1M annual SGD revenue threshold and not IRAS-registered. SGD checkout sessions document this via session metadata. The future Stripe Tax switchover comment goes at the top of the checkout route function, and the `tax_behavior`/`tax_code` future switch goes in `line_items[0].price_data` (not session level).
- **Item 31**: Singapore address and phone are user-provided business details — implement with HTML comments showing exactly what needs to be filled in.

## Open Questions

### Resolved During Planning

- **SGD exchange rate policy**: SGD packages are priced to match USD value at ~0.75 SGD/USD (intentional — gives Singapore users roughly USD-parity, not a windfall). Policy: reprice if SGD/USD drifts more than ±15% from 0.75, reviewed quarterly. Documented in SPEC.md.
- **GST applicability**: User confirmed PropFrame is below S$1M annual SGD revenue. GST does not apply. Checkout sessions add metadata documenting this exemption. Future trigger: if/when revenue exceeds S$1M, register with IRAS and enable Stripe Tax.
- **Stripe tax code for video credits**: Use `txcd_10402000` ("Digital audio visual works") — not `txcd_10503001` which is for downloadable documents/newsletters. `txcd_10402000` is the correct code for AI-generated video content.

## Implementation Units

- [ ] **Unit 1: Item 29 — Document SGD exchange rate policy in SPEC.md**

**Goal:** Add SGD pricing section and restructure credit packages into a proper table in SPEC.md.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `SPEC.md`

**Approach:**
Two changes to SPEC.md:

1. **Credit packages → table**: Convert the credit packages bullet into a markdown table with USD and SGD rows:
   ```
   | Package | Credits | USD Price | SGD Price |
   |---------|---------|-----------|-----------|
   | Starter | 50 | $12.50 | S$17 |
   | Standard | 200 | $49 | S$65 |
   | Pro | 600 | $149 | S$199 |
   | Team | 1,200 | $299 | S$399 |
   ```
   Note: SGD prices are calibrated to ~0.75 SGD/USD exchange rate — they match USD value, not a fixed SGD peg.

3. **New SGD exchange rate subsection**: After the "No subscription" bullet in the Billing section, add:
   ```
   ### SGD Pricing Policy
   SGD packages are priced at approximately 0.75 SGD/USD (matching USD value at current rates).
   Policy: review and reprice if SGD/USD exchange rate moves more than ±15% from 0.75, reviewed quarterly.
   Stripe fees (2.9% + $0.30 per transaction) are absorbed in the per-pack price — no additional fees.
   ```

**Patterns to follow:** Existing SPEC.md Billing section structure. Markdown tables for pricing.

**Test scenarios:**
- SPEC.md contains SGD exchange rate policy subsection
- Credit packages table has both USD and SGD rows with matching values

**Verification:**
`grep -c "0.75\|SGD/USD" SPEC.md` returns ≥1. `grep "SGD Price" SPEC.md` returns the table header.

---

- [ ] **Unit 2: Item 30 — Document GST exemption in checkout and SPEC.md**

**Goal:** Add GST exemption metadata to SGD Stripe checkout sessions and document the future switchover trigger.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `app/api/billing/checkout/route.ts`
- Modify: `SPEC.md`

**Approach:**
1. **GST comment block at top of function** (after imports, before the `POST` function):
   ```typescript
   /*
    * Singapore GST Policy:
    * PropFrame is currently below S$1M annual SGD revenue.
    * GST does not apply to SGD transactions.
    * When/if annual SGD revenue exceeds S$1M:
    *   1. Register for GST with IRAS
    *   2. Enable Stripe Tax in Stripe Dashboard → Tax
    *   3. In line_items[0].price_data for SGD, add:
    *        tax_behavior: 'exclusive'
    *        tax_code: 'txcd_10402000'  // Digital audio visual works
    *   4. Remove the gst_applicable: 'false' metadata from SGD sessions
    *   5. Update SPEC.md to reflect GST-inclusive pricing
    */
   ```

2. **SGD metadata — spread-merge** (preserve existing fields):
   In `metadata` block at line 91, add conditional spread for SGD only:
   ```typescript
   metadata: {
     ...(currency === 'SGD' ? {
       gst_applicable: 'false',
     } : {}),
     userId: payload.userId,
     credits: credits.toString(),
     dollars: dollars?.toString() ?? '',
     sgd: sgd?.toString() ?? '',
     currency: currencyCode,
     ...(orgId && { orgId }),
   },
   ```
   Note: The `gst_applicable` metadata is documentation only — Stripe does not automatically interpret this. The exemption is enforced by not setting `tax_behavior`.

3. **SPEC.md Billing section addendum**: Add bullet: "Singapore GST does not apply at current revenue level (< S$1M/year). Future switchover documented in checkout route and triggered when revenue exceeds S$1M."

**Patterns to follow:** Existing checkout route metadata pattern with spread-merging. Block comment style from existing route files.

**Test scenarios:**
- SGD checkout session includes `metadata.gst_applicable: 'false'` AND all existing metadata fields
- USD checkout session unchanged (no gst_applicable field)
- Comment block visible at top of route function
- SPEC.md has GST exemption note

**Verification:**
`POST /api/billing/checkout` with `currency: 'SGD'` → inspect Stripe dashboard session metadata for `gst_applicable: 'false'`. USD session has no `gst_applicable` key.

---

- [ ] **Unit 3: Item 31 — Add Singapore address + phone to legal pages**

**Goal:** Add a Singapore postal address and phone number to privacy policy, ToS, and footer — required by PDPA for the data controller contact. HTML comments show exactly what to fill in.

**Requirements:** R3

**Dependencies:** User must provide the actual address and phone number before fields can be fully populated

**Files:**
- Modify: `app/legal/privacy-policy/page.tsx`
- Modify: `app/legal/terms-of-service/page.tsx`
- Modify: `components/landing/LandingFooter.tsx`

**Approach:**
In `privacy-policy/page.tsx` section 10 (Contact), replace current address with:
```
PropFrame · Singapore
<!-- TODO (PDPA): Add Singapore registered business address and phone -->
Email: privacy@propframe.io
Data Protection Officer: dpo@propframe.io
```

Same pattern in `terms-of-service/page.tsx` section 12 (Contact).

In `LandingFooter.tsx`, add below the brand paragraph:
```
Singapore · privacy@propframe.io
<!-- TODO (PDPA): Add address and phone when available -->
```

**Patterns to follow:** Existing legal page section format.

**Test scenarios:**
- Privacy policy renders at `/privacy` — HTML source contains `TODO (PDPA)` comment
- ToS renders at `/terms` — HTML source contains `TODO (PDPA)` comment
- Footer renders at `/` — HTML source contains `TODO (PDPA)` comment
- No broken links or rendering errors

**Verification:**
Legal pages load at `/privacy` and `/terms`. Footer renders at `/`. HTML source has `grep "TODO (PDPA)"` match in each file.

---

## System-Wide Impact

- **Item 30**: Future trigger is clearly documented in the comment block. The single reference point makes the switchover low-risk when revenue grows. Metadata is documentation only — Stripe does not auto-exempt based on it.
- **Item 31**: HTML comments are invisible to users but visible in source. Address/phone must be populated before production launch.
- **Item 29**: SPEC.md is the source of truth for SGD policy. When repricing is triggered, this document initiates the decision.

## Risks & Dependencies

- **Item 31**: HTML `<!-- comments -->` are invisible to users but unprofessional in source code review. Acceptable tradeoff for "ready to fill in" structure.
- **Item 30**: The `gst_applicable: 'false'` metadata is PropFrame's own record-keeping — Stripe does not interpret it. Enforcement of the GST exemption is by business policy, not technical lock.

## Documentation / Operational Notes

- **Future GST switchover** (Item 30): When/if SGD revenue exceeds S$1M — (1) Register with IRAS, (2) Enable Stripe Tax in Stripe Dashboard → Tax for Singapore, (3) In `line_items[0].price_data` for SGD, add `tax_behavior: 'exclusive'` and `tax_code: 'txcd_10402000'`, (4) Remove `gst_applicable: 'false'` from SGD session metadata, (5) Update SPEC.md.
- **PDPA contact** (Item 31): Address and phone must match actual Singapore business registration. User provides these.
- **Stripe tax code**: Use `txcd_10402000` ("Digital audio visual works") — correct for AI-generated video content. Not `txcd_10503001` (downloadable documents).

## Sources & References

- TODOS.md Items 29, 30, 31
- `app/api/billing/checkout/route.ts` — current Stripe checkout (metadata block at lines 91-98, line_items at lines 77-84)
- `app/legal/privacy-policy/page.tsx` — current privacy policy
- `app/legal/terms-of-service/page.tsx` — current ToS
- `components/landing/LandingFooter.tsx` — current footer
- `docs/plans/singapore-market.md` — broader Singapore launch context
- Stripe Tax documentation: `txcd_10402000` = "Digital audio visual works"
