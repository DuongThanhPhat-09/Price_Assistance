import "server-only";
import { toGeminiSchema } from "../json-schema";
import { codeForStatus, parseModelJson, requestJson, toBase64 } from "../http";
import {
  VisionProviderError,
  type StructuredVisionRequest,
  type StructuredVisionResponse,
  type VisionProvider,
} from "../types";

// Google retires models for new users after about a year (gemini-2.5-flash
// was in Oct 2026); the Settings page can override this without a deploy.
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface GenerateContentResponse {
  modelVersion?: string;
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

const BLOCKED_FINISH_REASONS = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]);

/** Google Gemini `generateContent` with inline image and JSON response schema. */
export class GeminiVisionProvider implements VisionProvider {
  readonly id = "gemini" as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string = GEMINI_DEFAULT_MODEL,
  ) {}

  async generateStructured(req: StructuredVisionRequest): Promise<StructuredVisionResponse> {
    const body = {
      systemInstruction: { parts: [{ text: req.instructions }] },
      contents: [
        {
          role: "user",
          parts: [
            ...req.images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: toBase64(img.data) } })),
            { text: req.prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(req.schema),
        // No temperature: Gemini 3 models are tuned for the default and may
        // loop or degrade when it is lowered.
      },
    };

    const data = (await requestJson(
      this.id,
      `${BASE_URL}/models/${encodeURIComponent(this.model)}:generateContent`,
      { headers: { "x-goog-api-key": this.apiKey }, body, timeoutMs: req.timeoutMs, signal: req.signal },
      classifyGeminiError,
    )) as GenerateContentResponse;

    if (data.promptFeedback?.blockReason) {
      throw new VisionProviderError("refused", `The photo was blocked (${data.promptFeedback.blockReason})`, this.id);
    }
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason && BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
      throw new VisionProviderError("refused", `The answer was blocked (${candidate.finishReason})`, this.id);
    }
    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new VisionProviderError("invalid_response", "The AI answer was cut off", this.id);
    }
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join("");
    if (!text) throw new VisionProviderError("invalid_response", "The AI returned an empty answer", this.id);

    return {
      output: parseModelJson(this.id, text),
      provider: this.id,
      model: data.modelVersion ?? this.model,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      },
    };
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const data = (await requestJson(
      this.id,
      `${BASE_URL}/models?pageSize=1000`,
      { headers: { "x-goog-api-key": this.apiKey }, timeoutMs: 15_000, signal },
      classifyGeminiError,
    )) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    return pickGeminiVisionModels(data.models ?? []);
  }
}

// Gemini models that generate media, embed, speak or stream — not useful
// for "read this photo and answer in JSON".
const NON_VISION_GEMINI = /embed|imagen|image|tts|audio|live|aqa|veo|lyria|robotics|computer-use|learnlm/i;

/** Text-generating Gemini models, Flash first (fast and cheap), newest first. */
export function pickGeminiVisionModels(models: { name?: string; supportedGenerationMethods?: string[] }[]): string[] {
  const ids = models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter((id) => id.startsWith("gemini") && !NON_VISION_GEMINI.test(id));
  const rank = (id: string) => (/flash/.test(id) ? 0 : 1);
  return [...new Set(ids)].sort((a, b) => rank(a) - rank(b) || b.localeCompare(a, "en", { numeric: true }));
}

export function classifyGeminiError(status: number, body: unknown) {
  const err = (body as { error?: { message?: string; status?: string; details?: { reason?: string }[] } } | null)?.error;
  const message = err?.message || `Gemini returned HTTP ${status}`;
  // An invalid key comes back as 400 INVALID_ARGUMENT with reason API_KEY_INVALID.
  if (err?.details?.some((d) => d.reason === "API_KEY_INVALID") || /api key/i.test(message)) {
    return { code: "auth" as const, message };
  }
  // 429 RESOURCE_EXHAUSTED says "quota" for per-minute limits too, so it
  // stays "rate_limit" (try again shortly) rather than "out of credit".
  return { code: codeForStatus(status), message };
}
