import { NextResponse, type NextRequest } from "next/server";
import { jsonError, withErrorHandling } from "@/server/http";
import { aiErrorResponse } from "@/server/ai/http-errors";
import { clientKey, createRateLimiter } from "@/server/rate-limit";
import { ALLOWED_IMAGE_TYPES } from "@/server/services/image-storage";
import { recognizeProductPhoto } from "@/server/services/recognition-service";
import { appConfig, LOCALE_COOKIE, type Locale } from "@/lib/config";

export const dynamic = "force-dynamic";
// Vision models usually answer in 3–10 s; allow for slow ones.
export const maxDuration = 60;

// The phone downscales photos to ~1600 px (a few hundred KB). Vercel caps
// request bodies at 4.5 MB, so anything near that is rejected early.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 512 * 1024;

// Each call costs money: 20 photos a minute per client is plenty for a person.
const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });

async function readImage(file: FormDataEntryValue | null, maxBytes: number) {
  if (!(file instanceof File) || file.size === 0) return null;
  const mimeType = file.type || "image/jpeg";
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) return "bad_type" as const;
  if (file.size > maxBytes) return "too_large" as const;
  return { data: new Uint8Array(await file.arrayBuffer()), mimeType };
}

/**
 * POST multipart/form-data
 *   image      product photo (JPEG/PNG/WebP, ≤ 4 MB) — required
 *   thumbnail  small JPEG kept as the product picture — optional
 *   barcode    barcode the phone decoded from the photo — optional
 *   mode       "lookup" (customer camera: open a known product) or "create" (default)
 * → 200 RecognitionResponse
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!limiter.take(clientKey(req))) {
    return jsonError(429, "Too many photos in a short time. Please wait a minute.", { code: "rate_limit" });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, 'Send the photo as multipart/form-data in the "image" field', { code: "bad_image" });
  }

  const image = await readImage(form.get("image"), MAX_IMAGE_BYTES);
  if (!image) return jsonError(400, 'Attach a photo as the "image" field', { code: "bad_image" });
  if (image === "bad_type") return jsonError(415, "Please use a JPEG, PNG or WebP photo", { code: "bad_image" });
  if (image === "too_large") return jsonError(413, "The photo is too large (max 4 MB)", { code: "too_large" });

  const thumb = await readImage(form.get("thumbnail"), MAX_THUMBNAIL_BYTES);
  const barcode = form.get("barcode");
  const mode = form.get("mode") === "lookup" ? "lookup" : "create";
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  const locale: Locale = cookieLocale === "en" || cookieLocale === "vi" ? cookieLocale : appConfig.defaultLocale;

  try {
    const result = await recognizeProductPhoto({
      image,
      thumbnail: typeof thumb === "object" ? thumb : null,
      locale,
      barcode: typeof barcode === "string" ? barcode.slice(0, 64) : null,
      mode,
      signal: req.signal,
    });
    return NextResponse.json(result);
  } catch (e) {
    const res = aiErrorResponse(e);
    if (res) return res;
    throw e;
  }
});
