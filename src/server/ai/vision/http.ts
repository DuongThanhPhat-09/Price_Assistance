import "server-only";
import { VisionProviderError, type VisionErrorCode, type VisionProviderId } from "./types";

export const DEFAULT_TIMEOUT_MS = 45_000;

/** Combines the caller's signal (user cancelled) with our timeout. */
function requestSignal(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/**
 * Calls a provider (POST with a JSON body, or GET without one) and returns
 * the parsed body. Network failures and non-2xx responses become
 * VisionProviderError; `classify` maps a provider's own error format to our codes.
 */
export async function requestJson(
  provider: VisionProviderId,
  url: string,
  init: { headers: Record<string, string>; body?: unknown; timeoutMs?: number; signal?: AbortSignal },
  classify: (status: number, body: unknown) => { code: VisionErrorCode; message: string },
): Promise<unknown> {
  let res: Response;
  const hasBody = init.body !== undefined;
  try {
    res = await fetch(url, {
      method: hasBody ? "POST" : "GET",
      headers: { ...(hasBody ? { "Content-Type": "application/json" } : {}), ...init.headers },
      body: hasBody ? JSON.stringify(init.body) : undefined,
      signal: requestSignal(init.timeoutMs ?? DEFAULT_TIMEOUT_MS, init.signal),
      cache: "no-store",
    });
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "TimeoutError") throw new VisionProviderError("timeout", "The AI service took too long to answer", provider);
    if (name === "AbortError") throw e; // cancelled by the caller
    throw new VisionProviderError("unavailable", `Could not reach the AI service: ${(e as Error).message}`, provider);
  }

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep the raw text for the error message */
  }

  if (!res.ok) {
    const { code, message } = classify(res.status, body);
    throw new VisionProviderError(code, message, provider, res.status);
  }
  return body;
}

/** Default HTTP status → error code mapping shared by providers. */
export function codeForStatus(status: number): VisionErrorCode {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "model";
  if (status === 429) return "rate_limit";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "unavailable";
  return "bad_request";
}

/** Models sometimes wrap JSON in ```json fences despite being told not to. */
export function parseModelJson(provider: VisionProviderId, text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new VisionProviderError("invalid_response", "The AI answer was not valid JSON", provider);
  }
}

export function toBase64(data: Uint8Array): string {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("base64");
}
