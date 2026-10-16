import type { PriceSource } from "./types";

/**
 * The vision model's own guess, made while it read the packaging. It is a
 * suggestion only — not a price seen in any real shop — and the UI labels
 * it "Suggested Price (AI Estimate)" everywhere.
 */
export const aiEstimateSource: PriceSource = {
  id: "ai_estimate",
  isEnabled: () => true,
  async suggest(product) {
    if (product.estimatedPrice === null || product.estimatedPrice <= 0) return [];
    return [
      {
        source: "ai_estimate",
        amount: product.estimatedPrice,
        kind: "ai",
        sourceName: null,
        url: null,
        observedAt: new Date().toISOString(),
      },
    ];
  },
};
