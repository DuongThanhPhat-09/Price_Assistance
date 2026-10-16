import "server-only";
import { resolveVisionChain, resolveVisionConfig, type VisionConfig } from "../../services/ai-settings-service";
import { FallbackVisionProvider } from "./fallback";
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

function notConfigured(provider?: VisionProviderId) {
  return new VisionProviderError(
    "not_configured",
    "Smart Recognition is not set up: add an API key in Admin → Smart Recognition settings",
    provider,
  );
}

/** Every configured model in the order they are tried (main first). */
export async function getVisionChain(): Promise<VisionProvider[]> {
  return (await resolveVisionChain()).map(createVisionProvider);
}

/**
 * What tasks use: the main model, with retries and the fallback models
 * behind it. Throws "not_configured" when no model has a key.
 */
export async function getVisionProvider(): Promise<VisionProvider> {
  const chain = await getVisionChain();
  if (chain.length === 0) throw notConfigured();
  return new FallbackVisionProvider(chain);
}

/** One provider with its own key and model, no fallback (listing models). */
export async function getSingleVisionProvider(provider: VisionProviderId): Promise<VisionProvider> {
  const config = await resolveVisionConfig(provider);
  if (!config) throw notConfigured(provider);
  return createVisionProvider(config);
}
