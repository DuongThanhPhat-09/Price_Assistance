import { NextResponse, type NextRequest } from "next/server";
import { jsonError, withErrorHandling } from "@/server/http";
import { getAIProviders } from "@/server/ai/registry";

export const dynamic = "force-dynamic";

/**
 * PHASE 2 PLACEHOLDER — Camera product recognition.
 *
 * POST multipart/form-data { image: File }
 * → 200 { matches: ProductMatch[] } once a provider is registered
 * → 501 until then.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const service = getAIProviders().productRecognition;
  if (!service) {
    return jsonError(501, "Camera product recognition is coming in a future version.");
  }

  const form = await req.formData();
  const image = form.get("image");
  if (!(image instanceof File)) return jsonError(400, 'Attach a photo as the "image" field');

  const matches = await service.identify({
    image: new Uint8Array(await image.arrayBuffer()),
    mimeType: image.type || "image/jpeg",
    locale: req.headers.get("accept-language") ?? undefined,
  });
  return NextResponse.json({ matches });
});
