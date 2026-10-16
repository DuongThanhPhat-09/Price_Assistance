import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { ImportResult, ProductDTO, ProductListResponse } from "@/lib/types";
import { toProductDTO } from "../mappers";
import type { ProductInput } from "@/lib/validation";
import { invalidateSearchIndex } from "./search-service";

export class DuplicateBarcodeError extends Error {
  constructor(barcode: string) {
    super(`Another product already uses barcode ${barcode}`);
    this.name = "DuplicateBarcodeError";
  }
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export async function getProductById(id: number): Promise<ProductDTO | null> {
  const p = await prisma.product.findUnique({ where: { id } });
  return p ? toProductDTO(p) : null;
}

export async function getProductByBarcode(barcode: string): Promise<ProductDTO | null> {
  const p = await prisma.product.findUnique({ where: { barcode } });
  return p ? toProductDTO(p) : null;
}

export async function listProducts(opts: {
  page?: number;
  pageSize?: number;
  category?: string;
}): Promise<ProductListResponse> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
  const where: Prisma.ProductWhereInput = opts.category ? { category: opts.category } : {};
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  return { items: items.map(toProductDTO), total, page, pageSize };
}

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

/** Set only by Smart Product Recognition, never by the normal product form. */
export type AIProductFields = Pick<
  Prisma.ProductCreateInput,
  "aiConfidence" | "aiEstimatedPrice" | "recognizedText" | "recognitionProvider"
>;

export async function createProduct(input: ProductInput, ai?: AIProductFields): Promise<ProductDTO> {
  try {
    const p = await prisma.product.create({ data: { ...input, ...ai } });
    invalidateSearchIndex();
    return toProductDTO(p);
  } catch (e) {
    if (isUniqueViolation(e) && input.barcode) throw new DuplicateBarcodeError(input.barcode);
    throw e;
  }
}

export async function updateProduct(id: number, input: ProductInput): Promise<ProductDTO | null> {
  try {
    const p = await prisma.product.update({ where: { id }, data: input });
    invalidateSearchIndex();
    return toProductDTO(p);
  } catch (e) {
    if (isUniqueViolation(e) && input.barcode) throw new DuplicateBarcodeError(input.barcode);
    if ((e as { code?: string }).code === "P2025") return null;
    throw e;
  }
}

export async function deleteProduct(id: number): Promise<boolean> {
  const res = await prisma.product.deleteMany({ where: { id } });
  invalidateSearchIndex();
  return res.count > 0;
}

/**
 * Bulk upsert. Rows with a barcode update the matching product (or create
 * it); rows without a barcode are matched by exact name, else created.
 */
export async function importProducts(
  rows: { row: number; input: ProductInput }[],
  preFailed: ImportResult["failed"] = [],
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, failed: [...preFailed] };

  for (const { row, input } of rows) {
    try {
      const existing = input.barcode
        ? await prisma.product.findUnique({ where: { barcode: input.barcode }, select: { id: true } })
        : await prisma.product.findFirst({ where: { name: input.name, barcode: null }, select: { id: true } });

      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data: input });
        result.updated++;
      } else {
        await prisma.product.create({ data: input });
        result.created++;
      }
    } catch (e) {
      result.failed.push({ row, error: e instanceof Error ? e.message : String(e) });
    }
  }

  invalidateSearchIndex();
  result.failed.sort((a, b) => a.row - b.row);
  return result;
}
