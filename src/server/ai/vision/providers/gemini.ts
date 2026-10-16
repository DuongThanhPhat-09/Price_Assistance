import "server-only";
import { toGeminiSchema } from "../json-schema";
import { codeForStatus, parseModelJson, postJson, toBase64 } from "../http";
import {
  VisionProviderError,
  type StructuredVisionRequest,
  type StructuredVisionResponse,
  type VisionProvider,
} from "../types";

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
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
        temperature: 0.2,
      },
    };

    const data = (await postJson(
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
      model: data.modelVersion ?? this.model,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      },
    };
  }
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
