import { NextResponse, type NextRequest } from "next/server";
import { jsonError, withErrorHandling } from "@/server/http";
import { importProducts } from "@/server/services/product-service";
import { parseProductCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/products/import
 * Body: multipart/form-data with a "file" field, or a raw text/csv body.
 * Upserts by barcode. Returns { created, updated, failed[] }.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const contentType = req.headers.get("content-type") ?? "";
  let text: string;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(400, 'Attach the CSV as a "file" field');
    if (file.size > MAX_BYTES) return jsonError(413, "File is larger than 5 MB");
    text = await file.text();
  } else {
    text = await req.text();
    if (text.length > MAX_BYTES) return jsonError(413, "File is larger than 5 MB");
  }

  if (!text.trim()) return jsonError(400, "The file is empty");

  const { rows, failed } = parseProductCsv(text);
  if (rows.length === 0 && failed.length > 0 && failed[0].row === 1) {
    return jsonError(400, failed[0].error);
  }
  return NextResponse.json(await importProducts(rows, failed));
});
