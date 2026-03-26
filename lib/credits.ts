// Credit costs for each operation
export const CREDIT_COSTS = {
  clip_720p: 1,
  clip_1080p: 2,
  clip_4k: 4,
  auto_edit: 1,
  virtual_staging: 1,  // per photo
  sky_replacement: 1,  // per photo
  music_generation: 2,
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;

export function getClipCost(resolution: '720p' | '1080p' | '4k'): number {
  switch (resolution) {
    case '720p': return CREDIT_COSTS.clip_720p;
    case '1080p': return CREDIT_COSTS.clip_1080p;
    case '4k': return CREDIT_COSTS.clip_4k;
  }
}

export function formatCredits(credits: number): string {
  if (credits >= 1000) {
    return `$${(credits / 100).toFixed(2)}`;
  }
  return `${credits} credits`;
}

export function parseCreditsToDollars(credits: number): number {
  return credits / 100;
}

export function dollarsToCredits(dollars: number): number {
  return Math.round(dollars * 100);
}

export const CREDIT_PACKAGES = [
  { credits: 25000, dollars: 20, label: '$20' },
  { credits: 62500, dollars: 50, label: '$50' },
  { credits: 130000, dollars: 100, label: '$100' },
] as const;
