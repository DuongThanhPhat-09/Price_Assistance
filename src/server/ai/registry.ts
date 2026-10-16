import "server-only";
import {
  AIFeatureUnavailableError,
  type InventoryForecaster,
  type NaturalLanguageQueryParser,
  type SalesAssistant,
} from "./types";

/**
 * Single place where the later-phase AI providers are chosen. Every slot
 * is empty today; to add one, implement the interface and return it here.
 *
 * Vision (photo) features are configured from the admin portal instead —
 * see ./vision/factory.ts and services/ai-settings-service.ts.
 */
export interface AIProviders {
  salesAssistant: SalesAssistant | null;
  forecaster: InventoryForecaster | null;
  nlQuery: NaturalLanguageQueryParser | null;
}

let providers: AIProviders | null = null;

export function getAIProviders(): AIProviders {
  if (!providers) {
    providers = {
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
