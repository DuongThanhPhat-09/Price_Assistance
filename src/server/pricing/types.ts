import type { PriceSourceId, PriceSuggestionDTO, RecognizedProductDTO } from "@/lib/types";

/**
 * A place a reference price can come from. Today only the AI estimate
 * exists. Future sources plug in here without touching the UI:
 *
 *   - "ecommerce"  — a marketplace's official product/price API
 *   - "supplier"   — the shop's own supplier catalogues (CSV/API price lists)
 *   - "competitor" — prices the owner records for nearby shops
 *
 * Sources must use official APIs or data the shop owns. Scraping websites
 * is deliberately out of scope.
 */
export interface PriceSource {
  id: PriceSourceId;
  /** Off by default until configured, so a missing key never slows a lookup. */
  isEnabled(): boolean | Promise<boolean>;
  /** Must resolve quickly (a few seconds at most) and never throw for "no price". */
  suggest(product: PriceQuery, signal?: AbortSignal): Promise<PriceSuggestionDTO[]>;
}

/** What a source gets to look a product up by. */
export type PriceQuery = Pick<RecognizedProductDTO, "name" | "brand" | "model" | "variant" | "category" | "barcode" | "estimatedPrice">;
