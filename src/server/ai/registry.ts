import "server-only";
import {
  AIFeatureUnavailableError,
  type ImageRecognitionProvider,
  type InventoryForecaster,
  type NaturalLanguageQueryParser,
  type ProductRecognitionService,
  type SalesAssistant,
} from "./types";

/**
 * Single place where AI providers are chosen. Today every slot is empty;
 * to add one, implement the interface in ./providers/<name>.ts and return
 * it here (e.g. based on process.env.AI_PROVIDER).
 */
export interface AIProviders {
  imageRecognition: ImageRecognitionProvider | null;
  productRecognition: ProductRecognitionService | null;
  salesAssistant: SalesAssistant | null;
  forecaster: InventoryForecaster | null;
  nlQuery: NaturalLanguageQueryParser | null;
}

let providers: AIProviders | null = null;

export function getAIProviders(): AIProviders {
  if (!providers) {
    providers = {
      imageRecognition: null,
      productRecognition: null,
      salesAssistant: null,
      forecaster: null,
      nlQuery: null,
    };
  }
  return providers;
}

export function requireAI<K extends keyof AIProviders>(key: K): NonNullable<AIProviders[K]> {
  const p = getAIProviders()[key];
  if (!p) throw new AIFeatureUnavailableError(key);
  return p as NonNullable<AIProviders[K]>;
}

export function aiFeatureFlags() {
  const p = getAIProviders();
  return {
    imageRecognition: !!p.productRecognition,
    salesAssistant: !!p.salesAssistant,
    forecasting: !!p.forecaster,
    naturalLanguageQuery: !!p.nlQuery,
  };
}
