// Credit costs per operation — COGS-calibrated (profitable from day 1)
// 1 credit = $0.25 USD
// COGS: Virtual staging ~$0.032, Sky replacement ~$0.002, Clip ~$1.00
export const CREDIT_COSTS = {
  clip_720p: 10,      // $2.50 at $0.25/credit — COGS $1.00 — 60% margin
  clip_1080p: 12,      // $3.00 — COGS ~$1.00 — 67% margin
  clip_4k: 16,         // $4.00 — COGS ~$1.00 — 75% margin
  auto_edit: 2,        // $0.50 — minimal COGS (assembly only)
  virtual_staging: 5,   // $1.25 — COGS $0.032 — 97% margin
  sky_replacement: 2,   // $0.50 — COGS $0.002 — 99.6% margin
  music_generation: 8,  // $2.00 — COGS ~$0.50 (Suno API estimate) — 75% margin
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;

export function getClipCost(resolution: '720p' | '1080p' | '4k'): number {
  switch (resolution) {
    case '720p': return CREDIT_COSTS.clip_720p;
    case '1080p': return CREDIT_COSTS.clip_1080p;
    case '4k': return CREDIT_COSTS.clip_4k;
  }
}

// 1 credit = $0.25 USD
export const CREDIT_TO_DOLLAR_RATE = 0.25;

export function formatCredits(credits: number): string {
  const dollarValue = credits * CREDIT_TO_DOLLAR_RATE;
  if (credits >= 4) {
    return `$${dollarValue.toFixed(2)}`;
  }
  return `${credits} credits`;
}

export function parseCreditsToDollars(credits: number): number {
  return credits * CREDIT_TO_DOLLAR_RATE;
}

export function dollarsToCredits(dollars: number): number {
  return Math.round(dollars * 4); // 1 dollar = 4 credits
}

// USD credit packages — 1 credit = $0.25
export const USD_CREDIT_PACKAGES = [
  { credits: 50,   dollars: 12.50, label: '$12.50', bonus: 0    },
  { credits: 200,  dollars: 49,   label: '$49',    bonus: 0    }, // most popular
  { credits: 600,  dollars: 149,   label: '$149',   bonus: 0    },
  { credits: 1200, dollars: 299,   label: '$299',   bonus: 0    }, // volume tier
] as const;

// SGD packages (Singapore) — 1 SGD ≈ 0.75 USD, price to match USD value
export const SGD_CREDIT_PACKAGES = [
  { credits: 50,   sgd: 17,    label: 'S$17',    bonus: 0    },  // ~$12.75 USD
  { credits: 200,  sgd: 65,    label: 'S$65',    bonus: 0    },  // ~$48.75 USD
  { credits: 600,  sgd: 199,   label: 'S$199',   bonus: 0    },  // ~$149.25 USD
  { credits: 1200, sgd: 399,   label: 'S$399',   bonus: 0    },  // ~$299.25 USD
] as const;

export const CREDIT_PACKAGES = USD_CREDIT_PACKAGES;

export function getCreditsForDollars(dollars: number): number {
  // Base rate: 1 dollar = 4 credits (no bonuses at new flat rate)
  const base = dollars * 4;
  const pkg = CREDIT_PACKAGES.find(p => p.dollars === dollars);
  return pkg ? pkg.credits : base;
}

export function getCreditsForSGD(sgd: number): number {
  // SGD packages priced to match USD value at ~0.75 SGD/USD
  const base = sgd * 3; // 1 SGD ≈ 3 credits at target USD equivalent
  const pkg = SGD_CREDIT_PACKAGES.find(p => p.sgd === sgd);
  return pkg ? pkg.credits : base;
}
