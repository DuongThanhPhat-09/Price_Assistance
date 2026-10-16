import "server-only";
import type { PriceSuggestionDTO } from "@/lib/types";
import { aiEstimateSource } from "./ai-estimate";
import type { PriceQuery, PriceSource } from "./types";

export type { PriceQuery, PriceSource } from "./types";

/** Add future sources (e-commerce API, supplier catalogue, competitor log) here. */
const SOURCES: PriceSource[] = [aiEstimateSource];

/** Each source gets this long; a slow one is skipped, never awaited. */
const SOURCE_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/**
 * Reference prices for a recognised product, AI estimate first. A failing
 * or slow source is dropped so it can never block a lookup.
 */
export async function collectPriceSuggestions(
  product: PriceQuery,
  signal?: AbortSignal,
  sources: PriceSource[] = SOURCES,
): Promise<PriceSuggestionDTO[]> {
  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        if (!(await source.isEnabled())) return [];
        return await withTimeout(source.suggest(product, signal), SOURCE_TIMEOUT_MS, []);
      } catch (e) {
        console.warn(`[pricing] ${source.id} failed`, e);
        return [];
      }
    }),
  );
  return results.flat();
}
