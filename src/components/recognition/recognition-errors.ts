import { ApiRequestError } from "@/lib/api-client";
import { UnsupportedPhotoError } from "@/lib/photo";
import type { MessageKey } from "@/i18n/dictionaries";

/** Errors only the shop owner can fix in Smart Recognition settings. */
export const SETTINGS_CODES = new Set(["not_configured", "auth", "model"]);

/** Plain-language message for anything that went wrong recognising a photo. */
export function recognitionErrorMessage(e: unknown): MessageKey {
  if (e instanceof UnsupportedPhotoError) return "detect.error.bad_image";
  if (!(e instanceof ApiRequestError)) return typeof navigator !== "undefined" && !navigator.onLine ? "common.offline" : "common.error";
  switch (e.code) {
    case "not_configured":
    case "auth":
    case "quota":
    case "rate_limit":
    case "model":
      return `detect.error.${e.code}`;
    case "timeout":
    case "unavailable":
      return "detect.error.busy";
    case "refused":
    case "invalid_response":
    case "bad_request":
      return "detect.error.unreadable";
    case "bad_image":
    case "too_large":
      return "detect.error.bad_image";
    default:
      return "common.error";
  }
}

export function needsSettings(e: unknown): boolean {
  return e instanceof ApiRequestError && SETTINGS_CODES.has(e.code ?? "");
}
