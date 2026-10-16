import "server-only";
import { codeForStatus, parseModelJson, postJson, toBase64 } from "../http";
import {
  VisionProviderError,
  type StructuredVisionRequest,
  type StructuredVisionResponse,
  type VisionProvider,
} from "../types";

export const OPENAI_DEFAULT_MODEL = "gpt-4o";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

interface ChatCompletion {
  model?: string;
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * OpenAI Chat Completions with image input and strict structured output.
 * Works with GPT-4o and any later vision model that supports
 * `response_format: json_schema`. `baseUrl` allows OpenAI-compatible
 * gateways (Azure OpenAI proxies, LiteLLM…).
 */
export class OpenAIVisionProvider implements VisionProvider {
  readonly id = "openai" as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string = OPENAI_DEFAULT_MODEL,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  async generateStructured(req: StructuredVisionRequest): Promise<StructuredVisionResponse> {
    const body = {
      model: this.model,
      messages: [
        { role: "system", content: req.instructions },
        {
          role: "user",
          content: [
            { type: "text", text: req.prompt },
            ...req.images.map((img) => ({
              type: "image_url",
              // "high" so small print such as model numbers stays legible.
              image_url: { url: `data:${img.mimeType};base64,${toBase64(img.data)}`, detail: "high" },
            })),
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: req.task, strict: true, schema: req.schema },
      },
    };

    const data = (await postJson(
      this.id,
      `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      { headers: { Authorization: `Bearer ${this.apiKey}` }, body, timeoutMs: req.timeoutMs, signal: req.signal },
      classifyOpenAIError,
    )) as ChatCompletion;

    const choice = data.choices?.[0];
    if (choice?.message?.refusal) throw new VisionProviderError("refused", choice.message.refusal, this.id);
    if (choice?.finish_reason === "content_filter") {
      throw new VisionProviderError("refused", "The photo was blocked by the AI safety filter", this.id);
    }
    if (choice?.finish_reason === "length") {
      throw new VisionProviderError("invalid_response", "The AI answer was cut off", this.id);
    }
    const content = choice?.message?.content;
    if (!content) throw new VisionProviderError("invalid_response", "The AI returned an empty answer", this.id);

    return {
      output: parseModelJson(this.id, content),
      model: data.model ?? this.model,
      usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
    };
  }
}

export function classifyOpenAIError(status: number, body: unknown) {
  const err = (body as { error?: { message?: string; code?: string; type?: string } } | null)?.error;
  const message = err?.message || `OpenAI returned HTTP ${status}`;
  if (err?.code === "insufficient_quota") return { code: "quota" as const, message };
  if (err?.code === "model_not_found") return { code: "model" as const, message };
  if (err?.code === "invalid_api_key") return { code: "auth" as const, message };
  return { code: codeForStatus(status), message };
}
