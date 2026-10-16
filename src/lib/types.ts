/**
 * Shapes shared by API routes and UI. Dates travel as ISO strings and
 * money as integer minor units (see lib/money.ts).
 */

export type SearchType = "text" | "voice" | "barcode" | "image";

export interface ProductDTO {
  id: number;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
  shelfLocation: string | null;
  imageUrl: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  /** Set when the product was created from a photo (0..1). */
  aiConfidence: number | null;
  /** AI's rough price estimate in minor units — never a real market price. */
  aiEstimatedPrice: number | null;
  recognizedText: string | null;
  recognitionProvider: VisionProviderId | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResultDTO {
  product: ProductDTO;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResultDTO[];
  /** Product id to open immediately when the match is unambiguous. */
  confidentMatchId: number | null;
}

export interface ProductListResponse {
  items: ProductDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecentSearchDTO {
  id: number;
  keyword: string;
  searchType: SearchType;
  createdAt: string;
  product: Pick<ProductDTO, "id" | "name" | "price" | "category" | "imageUrl"> | null;
}

export interface ImportResult {
  created: number;
  updated: number;
  failed: { row: number; error: string }[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}

/* ------------------------------------------------------------------ */
/* Smart Product Recognition                                           */
/* ------------------------------------------------------------------ */

export type VisionProviderId = "openai" | "gemini";

/** What the AI read from one product photo, normalised. Money in minor units. */
export interface RecognizedProductDTO {
  /** False when the photo does not seem to show a sellable product. */
  isProduct: boolean;
  name: string;
  brand: string | null;
  model: string | null;
  variant: string | null;
  category: string;
  categoryAlternatives: string[];
  description: string | null;
  /** Only set when the digits pass the GS1 check (or were decoded on the phone). */
  barcode: string | null;
  keywords: string[];
  /** Text read from the packaging, one line per printed line. */
  visibleText: string[];
  estimatedPrice: number | null;
  /** 0..1 — the model's own estimate of how sure it is. */
  confidence: number;
}

export type MatchReason = "barcode" | "model" | "name" | "brand";

/** An existing catalogue product that may be the one in the photo. */
export interface ProductMatchDTO {
  product: ProductDTO;
  /** 0..1 */
  score: number;
  reasons: MatchReason[];
}

/**
 * Where a reference price comes from. Only "ai_estimate" exists today; the
 * others are reserved for future lookups (see src/server/pricing).
 */
export type PriceSourceId = "ai_estimate" | "ecommerce" | "supplier" | "competitor";

/** A reference price shown next to the shop's own price. Never applied automatically. */
export interface PriceSuggestionDTO {
  source: PriceSourceId;
  /** Minor units. */
  amount: number;
  /** "ai" = a model's guess; "observed" = a price actually seen somewhere. */
  kind: "ai" | "observed";
  /** Shop, supplier or site name for observed prices. */
  sourceName: string | null;
  url: string | null;
  /** ISO time the price was produced or seen. */
  observedAt: string;
}

export type LookupOutcome =
  /** One product is clearly the one in the photo: open it, no questions. */
  | { kind: "existing"; productId: number }
  /** Several products are equally likely (e.g. same model, two colours). */
  | { kind: "choose"; productIds: number[] }
  /** Nothing in the catalogue is close enough: offer to add it. */
  | { kind: "new" };

/** "lookup" = customer mode (open known products); "create" = admin adding stock. */
export type RecognitionMode = "lookup" | "create";

export interface RecognitionResponse {
  recognitionId: number;
  /** Thumbnail of the photo, stored so it can become the product image. */
  imageUrl: string | null;
  provider: VisionProviderId;
  model: string;
  result: RecognizedProductDTO;
  matches: ProductMatchDTO[];
  /** Lookup mode only: open a product, ask which one, or offer to add it. */
  outcome: LookupOutcome | null;
  /** Reference prices, AI estimate first. Today only the AI estimate. */
  priceSuggestions: PriceSuggestionDTO[];
  /** Below the threshold: warn, and require an explicit "I checked" before saving. */
  lowConfidence: boolean;
  durationMs: number;
}

export type RecognitionStatus = "recognized" | "failed" | "saving" | "created" | "linked";

export interface RecognitionLogDTO {
  id: number;
  imageUrl: string | null;
  recognizedName: string | null;
  confidence: number | null;
  provider: VisionProviderId;
  aiModel: string | null;
  status: RecognitionStatus;
  error: string | null;
  durationMs: number | null;
  /** Every model tried, in order; more than one means a fallback answered. */
  attempts: VisionAttemptDTO[] | null;
  createdAt: string;
  product: Pick<ProductDTO, "id" | "name"> | null;
}

export interface VisionAttemptDTO {
  provider: VisionProviderId;
  model: string;
  ok: boolean;
  /** Why it failed, e.g. "unavailable" (overloaded), "model", "auth". */
  code?: string;
  ms: number;
}

/** "own" = a fallback's own key; otherwise where its provider's key comes from. */
export type ApiKeySource = "env" | "settings" | "own" | null;

export interface VisionProviderSettingsDTO {
  model: string;
  defaultModel: string;
  /** Where the active key comes from. Env vars always win over saved keys. */
  keySource: ApiKeySource;
  /** Masked key, e.g. "sk-…a1b2". The key itself never leaves the server. */
  keyHint: string | null;
}

export interface FallbackModelDTO {
  id: string;
  provider: VisionProviderId;
  model: string;
  keySource: ApiKeySource;
  keyHint: string | null;
}

export interface AISettingsDTO {
  provider: VisionProviderId;
  /** The selected provider has an API key. */
  ready: boolean;
  providers: Record<VisionProviderId, VisionProviderSettingsDTO>;
  /** Tried in this order when the main model fails. */
  fallbacks: FallbackModelDTO[];
  /** False when SETTINGS_SECRET is unset and saved keys use the fallback key. */
  hasSettingsSecret: boolean;
}

/** Result of testing one model of the chain (main model first). */
export type AITestResult =
  | { ok: true; provider: VisionProviderId; model: string; durationMs: number }
  | { ok: false; provider: VisionProviderId; model: string; code: string; message: string };

export interface AITestResponse {
  results: AITestResult[];
}
