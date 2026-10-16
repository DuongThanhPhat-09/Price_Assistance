import "server-only";
import { jsonError } from "../http";
import { VisionProviderError, type VisionErrorCode } from "./vision/types";
import { RecognitionError, type RecognitionErrorCode } from "../services/recognition-service";

/**
 * Maps AI errors to HTTP responses. The body carries `details.code` so the
 * UI can show a plain-language message in the user's language.
 */
const VISION_STATUS: Record<VisionErrorCode, number> = {
  not_configured: 503,
  auth: 502,
  quota: 502,
  rate_limit: 429,
  model: 502,
  bad_request: 502,
  refused: 422,
  invalid_response: 502,
  timeout: 504,
  unavailable: 502,
};

const RECOGNITION_STATUS: Record<RecognitionErrorCode, number> = {
  not_found: 404,
  product_not_found: 404,
  not_recognized: 409,
  already_saved: 409,
  needs_review: 422,
};

/** Returns a response for a known AI error, or null so the caller rethrows. */
export function aiErrorResponse(e: unknown): Response | null {
  if (e instanceof VisionProviderError) {
    if (e.code !== "not_configured") console.warn(`[ai] ${e.provider ?? "?"} ${e.code}: ${e.message}`);
    return jsonError(VISION_STATUS[e.code], e.message, { code: e.code });
  }
  if (e instanceof RecognitionError) {
    return jsonError(RECOGNITION_STATUS[e.code], e.message, { code: e.code, productId: e.productId ?? null });
  }
  return null;
}
