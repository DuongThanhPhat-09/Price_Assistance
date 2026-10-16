/**
 * Provider-neutral vision contract.
 *
 * A VisionProvider knows how to talk to one AI vendor (auth, HTTP format,
 * error codes) and nothing about products. Tasks such as product
 * recognition (../tasks/) own the prompt and output schema and work with
 * any provider. Future tasks — invoice reading, shelf recognition, stock
 * counting — are new task files; the providers stay unchanged.
 */
import type { VisionProviderId } from "@/lib/types";
import type { JsonSchema } from "./json-schema";

export type { VisionProviderId };

export interface VisionImage {
  data: Uint8Array;
  /** image/jpeg, image/png or image/webp (accepted by every provider). */
  mimeType: string;
}

export interface StructuredVisionRequest {
  /** Short snake_case name of the task; some providers require one for the schema. */
  task: string;
  /** System-level instructions (role, rules). */
  instructions: string;
  /** The per-request message sent alongside the images. */
  prompt: string;
  images: VisionImage[];
  /** JSON Schema of the expected output (see json-schema.ts for the subset). */
  schema: JsonSchema;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface StructuredVisionResponse {
  /** Parsed JSON — not yet validated; the task validates it. */
  output: unknown;
  /** Provider that actually answered (differs from the first one after a fallback). */
  provider: VisionProviderId;
  /** Model that actually answered (may be more specific than the one requested). */
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  /** Every call made, in order (set by FallbackVisionProvider). */
  attempts?: VisionAttempt[];
}

/** One call to one model, for logs: did it answer, and if not, why. */
export interface VisionAttempt {
  provider: VisionProviderId;
  model: string;
  ok: boolean;
  code?: VisionErrorCode;
  ms: number;
}

export interface VisionProvider {
  readonly id: VisionProviderId;
  readonly model: string;
  generateStructured(request: StructuredVisionRequest): Promise<StructuredVisionResponse>;
  /** Model ids this key can use for image → text, best first. */
  listModels?(signal?: AbortSignal): Promise<string[]>;
}

export type VisionErrorCode =
  | "not_configured"
  | "auth" // key missing, wrong or not allowed
  | "quota" // account out of credit
  | "rate_limit"
  | "model" // model name not found / not available to this key
  | "bad_request"
  | "refused" // safety filter or explicit refusal
  | "invalid_response" // not valid JSON / does not match the schema
  | "timeout"
  | "unavailable"; // network error or provider 5xx

export class VisionProviderError extends Error {
  /** Calls made before giving up (set by FallbackVisionProvider). */
  attempts?: VisionAttempt[];

  constructor(
    public readonly code: VisionErrorCode,
    message: string,
    public readonly provider?: VisionProviderId,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "VisionProviderError";
  }
}
