import { NextResponse, type NextRequest } from "next/server";
import { jsonError, parseId, readJson, withErrorHandling } from "@/server/http";
import { aiErrorResponse } from "@/server/ai/http-errors";
import { DuplicateBarcodeError } from "@/server/services/product-service";
import { saveRecognizedProduct } from "@/server/services/recognition-service";
import { formatZodError, recognitionSaveSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/ai/recognitions/:id/save — create a product from a reviewed
 * recognition. Body: product fields (as POST /api/products) plus
 * `estimatedPrice` (minor units) and `reviewed` (required when confidence is low).
 */
export const POST = withErrorHandling(async (req: NextRequest, { params }: Ctx) => {
  const id = parseId((await params).id);
  if (!id) return jsonError(400, "Invalid recognition id");
  const parsed = recognitionSaveSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));

  try {
    return NextResponse.json(await saveRecognizedProduct(id, parsed.data), { status: 201 });
  } catch (e) {
    if (e instanceof DuplicateBarcodeError) return jsonError(409, e.message, { code: "duplicate_barcode" });
    const res = aiErrorResponse(e);
    if (res) return res;
    throw e;
  }
});
