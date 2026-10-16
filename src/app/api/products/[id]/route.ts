import { NextResponse, type NextRequest } from "next/server";
import { jsonError, parseId, readJson, withErrorHandling } from "@/server/http";
import {
  deleteProduct,
  DuplicateBarcodeError,
  getProductById,
  updateProduct,
} from "@/server/services/product-service";
import { formatZodError, productInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, { params }: Ctx) => {
  const id = parseId((await params).id);
  if (!id) return jsonError(400, "Invalid product id");
  const product = await getProductById(id);
  return product ? NextResponse.json(product) : jsonError(404, "Product not found");
});

export const PUT = withErrorHandling(async (req: NextRequest, { params }: Ctx) => {
  const id = parseId((await params).id);
  if (!id) return jsonError(400, "Invalid product id");
  const parsed = productInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));
  try {
    const product = await updateProduct(id, parsed.data);
    return product ? NextResponse.json(product) : jsonError(404, "Product not found");
  } catch (e) {
    if (e instanceof DuplicateBarcodeError) return jsonError(409, e.message);
    throw e;
  }
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: Ctx) => {
  const id = parseId((await params).id);
  if (!id) return jsonError(400, "Invalid product id");
  return (await deleteProduct(id)) ? new NextResponse(null, { status: 204 }) : jsonError(404, "Product not found");
});
