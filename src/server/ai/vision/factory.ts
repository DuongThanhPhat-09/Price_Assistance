import "server-only";
import { resolveVisionConfig, type VisionConfig } from "../../services/ai-settings-service";
import { GeminiVisionProvider } from "./providers/gemini";
import { OpenAIVisionProvider } from "./providers/openai";
import { VisionProviderError, type VisionProvider, type VisionProviderId } from "./types";

/** The single place that turns configuration into a provider instance. */
export function createVisionProvider(config: VisionConfig): VisionProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIVisionProvider(config.apiKey, config.model, process.env.OPENAI_BASE_URL?.trim() || undefined);
    case "gemini":
      return new GeminiVisionProvider(config.apiKey, config.model);
  }
}

/** The configured provider (or a specific one), or a "not_configured" error. */
export async function getVisionProvider(provider?: VisionProviderId): Promise<VisionProvider> {
  const config = await resolveVisionConfig(provider);
  if (!config) {
    throw new VisionProviderError(
      "not_configured",
      "Smart Recognition is not set up: add an API key in Admin → Smart Recognition settings",
      provider,
    );
  }
  return createVisionProvider(config);
}
