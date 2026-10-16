import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, withErrorHandling } from "@/server/http";
import { createProduct, DuplicateBarcodeError, listProducts } from "@/server/services/product-service";
import { searchProducts } from "@/server/services/search-service";
import { formatZodError, productInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/products?q=pan&limit=20      → fuzzy search (SearchResponse)
 * GET /api/products?page=1&pageSize=50  → paginated list (ProductListResponse)
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q");
  if (q !== null) {
    const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 20));
    return NextResponse.json(await searchProducts(q, limit));
  }
  return NextResponse.json(
    await listProducts({
      page: Number(sp.get("page")) || 1,
      pageSize: Number(sp.get("pageSize")) || 50,
      category: sp.get("category") || undefined,
    }),
  );
});

/** POST /api/products → create. Money fields are integer minor units. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const parsed = productInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));
  try {
    return NextResponse.json(await createProduct(parsed.data), { status: 201 });
  } catch (e) {
    if (e instanceof DuplicateBarcodeError) return jsonError(409, e.message);
    throw e;
  }
});
