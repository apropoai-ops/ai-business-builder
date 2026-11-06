/**
 * Model pricing — the single source of truth for estimating the USD cost of an
 * AI call from its token usage. Used by the per-business monthly cost cap
 * (lib/quota.ts) and any cost reporting. Prices are USD per 1,000,000 tokens
 * (input, output), matching Anthropic/OpenAI list pricing.
 */
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "text-embedding-3-small": { in: 0.02, out: 0 },
};

// Unknown model → price it as Sonnet (conservative: never under-count spend).
const FALLBACK = { in: 3, out: 15 } as const;

export function pricingFor(model: string): { in: number; out: number } {
  // Gemini models run on the FREE API tier — $0, and they must not eat into
  // the per-business monthly cost cap.
  if (model.startsWith("gemini")) return { in: 0, out: 0 };
  return MODEL_PRICING[model] ?? FALLBACK;
}

/**
 * Estimated USD cost of a single generation given its token counts. Safe with
 * undefined token counts (treated as 0) — some providers omit usage on error.
 */
export function estimateCostUsd(
  model: string,
  tokensIn = 0,
  tokensOut = 0,
): number {
  const p = pricingFor(model);
  return ((tokensIn ?? 0) * p.in + (tokensOut ?? 0) * p.out) / 1_000_000;
}
