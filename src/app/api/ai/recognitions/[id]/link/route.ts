import { NextResponse, type NextRequest } from "next/server";
import { jsonError, parseId, readJson, withErrorHandling } from "@/server/http";
import { aiErrorResponse } from "@/server/ai/http-errors";
import { linkRecognitionToProduct } from "@/server/services/recognition-service";
import { formatZodError, recognitionLinkSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/ai/recognitions/:id/link { productId } — "it's this existing product". */
export const POST = withErrorHandling(async (req: NextRequest, { params }: Ctx) => {
  const id = parseId((await params).id);
  if (!id) return jsonError(400, "Invalid recognition id");
  const parsed = recognitionLinkSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));

  try {
    return NextResponse.json(await linkRecognitionToProduct(id, parsed.data.productId));
  } catch (e) {
    const res = aiErrorResponse(e);
    if (res) return res;
    throw e;
  }
});
