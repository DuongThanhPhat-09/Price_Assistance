/**
 * Contracts for later AI features. Each capability is an interface so a
 * concrete provider can be plugged in via ./registry.ts without touching
 * routes or UI.
 *
 * Camera features (Smart Product Recognition today; invoices, shelves,
 * stock counting later) live in ./vision (providers) and ./tasks.
 */
import type { ProductDTO } from "@/lib/types";

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
