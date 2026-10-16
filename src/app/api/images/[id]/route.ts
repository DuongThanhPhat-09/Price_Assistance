import { type NextRequest } from "next/server";
import { jsonError, withErrorHandling } from "@/server/http";
import { readStoredImage } from "@/server/services/image-storage";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/images/:id — a stored product photo. Images never change, so cache forever. */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: Ctx) => {
  const image = await readStoredImage((await params).id);
  if (!image) return jsonError(404, "Image not found");
  return new Response(Buffer.from(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.data.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
});
