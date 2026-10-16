import Papa from "papaparse";
import { toMajor } from "./money";
import type { ProductDTO } from "./types";
import { CSV_COLUMNS, csvRowSchema, formatZodError, type ProductInput } from "./validation";

export interface ParsedCsv {
  rows: { row: number; input: ProductInput }[];
  failed: { row: number; error: string }[];
}

/** Accepts common header spellings: "Cost Price", "cost-price", "COST_PRICE". */
function normalizeHeader(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Parses a product CSV. Row numbers are 1-based spreadsheet rows
 * (row 1 is the header) so error messages match what the user sees in Excel.
 */
export function parseProductCsv(text: string): ParsedCsv {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  const out: ParsedCsv = { rows: [], failed: [] };
  const headers = parsed.meta.fields ?? [];
  if (!headers.includes("name") || !headers.includes("price")) {
    out.failed.push({
      row: 1,
      error: `Header row must contain at least "name" and "price". Expected columns: ${CSV_COLUMNS.join(", ")}`,
    });
    return out;
  }

  parsed.data.forEach((record, i) => {
    const row = i + 2;
    const result = csvRowSchema.safeParse(record);
    if (result.success) out.rows.push({ row, input: result.data });
    else out.failed.push({ row, error: formatZodError(result.error) });
  });

  // Same barcode twice in one file → keep the last, report the earlier ones.
  const lastRowForBarcode = new Map<string, number>();
  for (const r of out.rows) if (r.input.barcode) lastRowForBarcode.set(r.input.barcode, r.row);
  out.rows = out.rows.filter((r) => {
    if (!r.input.barcode || lastRowForBarcode.get(r.input.barcode) === r.row) return true;
    out.failed.push({ row: r.row, error: `Duplicate barcode ${r.input.barcode} (later row wins)` });
    return false;
  });

  return out;
}

/** Products → CSV in the same format the importer accepts. */
export function productsToCsv(products: ProductDTO[]): string {
  return Papa.unparse({
    fields: [...CSV_COLUMNS],
    data: products.map((p) => [
      p.barcode ?? "",
      p.name,
      p.description ?? "",
      p.category,
      toMajor(p.price),
      toMajor(p.costPrice),
      p.stockQuantity,
      p.shelfLocation ?? "",
      p.imageUrl ?? "",
      p.brand ?? "",
      p.model ?? "",
      p.variant ?? "",
    ]),
  });
}
