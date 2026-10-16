import { withErrorHandling } from "@/server/http";
import { prisma } from "@/server/db";
import { toProductDTO } from "@/server/mappers";
import { productsToCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** GET /api/products/export → all products as CSV (same format as import). */
export const GET = withErrorHandling(async () => {
  const products = await prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  const csv = "﻿" + productsToCsv(products.map(toProductDTO)); // BOM so Excel reads UTF-8
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${date}.csv"`,
    },
  });
});
