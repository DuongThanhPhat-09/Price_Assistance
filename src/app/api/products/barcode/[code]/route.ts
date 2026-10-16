import { NextResponse, type NextRequest } from "next/server";
import { jsonError, withErrorHandling } from "@/server/http";
import { getProductByBarcode } from "@/server/services/product-service";
import { cleanBarcode } from "@/lib/barcode";

export const dynamic = "force-dynamic";

/** GET /api/products/barcode/8934567000017 → exact barcode lookup. */
export const GET = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ code: string }> }) => {
    const code = cleanBarcode(decodeURIComponent((await params).code));
    if (!code) return jsonError(400, "Missing barcode");
    const product = await getProductByBarcode(code);
    return product ? NextResponse.json(product) : jsonError(404, "No product with this barcode");
  },
);
