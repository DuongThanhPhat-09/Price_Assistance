/**
 * Contracts for future AI features. Nothing here is implemented yet —
 * each capability is an interface so a concrete provider (Claude, a local
 * model, a vendor API…) can be plugged in via ./registry.ts without touching
 * routes or UI.
 */
import type { ProductDTO } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Phase 2 — Camera product recognition                                */
/* ------------------------------------------------------------------ */

export interface ImageRecognitionInput {
  /** Raw image bytes (JPEG/PNG/WebP) from the phone camera. */
  image: Uint8Array;
  mimeType: string;
  /** UI locale, so labels come back in the shop's language. */
  locale?: string;
}

/** One thing the model believes it sees in the photo. */
export interface RecognizedCandidate {
  /** Generic product type, e.g. "PVC pipe", "ball valve", "LED bulb". */
  product: string;
  /** Size / dimension if visible, e.g. "phi 27", "1.5mm²", "9W". */
  size?: string;
  /** Variant: brand, colour, model, e.g. "Bình Minh", "white", "A12". */
  variant?: string;
  /** 0..1 */
  confidence: number;
}

export interface ImageRecognitionResult {
  candidates: RecognizedCandidate[];
  /** Model/provider identifier for auditing. */
  model: string;
}

/** Turns a photo into structured guesses about what the product is. */
export interface ImageRecognitionProvider {
  readonly name: string;
  recognize(input: ImageRecognitionInput): Promise<ImageRecognitionResult>;
}

export interface ProductMatch {
  product: ProductDTO;
  /** Combined score: recognition confidence × catalogue match quality. */
  score: number;
  candidate: RecognizedCandidate;
}

/** Photo → products in *this* shop's catalogue. */
export interface ProductRecognitionService {
  identify(input: ImageRecognitionInput): Promise<ProductMatch[]>;
}

/* ------------------------------------------------------------------ */
/* Later phases                                                        */
/* ------------------------------------------------------------------ */

export interface SalesAssistantMessage {
  role: "user" | "assistant";
  content: string;
}

/** Answers staff/customer questions ("which valve fits a 27 pipe?"). */
export interface SalesAssistant {
  reply(
    conversation: SalesAssistantMessage[],
    context: { products: ProductDTO[]; locale: string },
  ): Promise<{ message: string; suggestedProductIds: number[] }>;
}

export interface ForecastPoint {
  date: string; // ISO date
  expectedUnitsSold: number;
}

/** Predicts demand so the owner knows what to reorder. */
export interface InventoryForecaster {
  forecast(productId: number, horizonDays: number): Promise<{
    points: ForecastPoint[];
    suggestedReorderQuantity: number;
    stockOutDate: string | null;
  }>;
}

/** Structured filter produced from a free-form question. */
export interface StructuredProductQuery {
  text?: string;
  category?: string;
  maxPrice?: number; // minor units
  minPrice?: number; // minor units
  inStockOnly?: boolean;
  sort?: "price_asc" | "price_desc" | "stock_asc" | "stock_desc";
}

/** "Ống nước dưới 50 nghìn còn hàng" → { text: "ống nước", maxPrice: 50000, inStockOnly: true } */
export interface NaturalLanguageQueryParser {
  parse(question: string, locale: string): Promise<StructuredProductQuery>;
}

export class AIFeatureUnavailableError extends Error {
  constructor(public readonly feature: string) {
    super(`AI feature "${feature}" is not available yet.`);
    this.name = "AIFeatureUnavailableError";
  }
}
