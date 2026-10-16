import { z } from "zod";
import { cleanBarcode } from "./barcode";
import { parseAmount, toMinor } from "./money";

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(max))
    .transform((v) => (v === "" ? null : v));

const imageUrl = optionalText(1000).refine(
  (v) => v === null || v.startsWith("/") || /^https?:\/\//i.test(v) || v.startsWith("data:image/"),
  { message: "Image must be a web address (https://…) or a path starting with /" },
);

/** Product payload for create/update. Money is integer minor units. */
export const productInputSchema = z.object({
  barcode: optionalText(64).transform((v) => (v ? cleanBarcode(v) : null)),
  name: z.string().trim().min(1, "Name is required").max(200),
  description: optionalText(2000),
  category: z.string().trim().min(1, "Category is required").max(100),
  price: z.number().int().min(0),
  costPrice: z.number().int().min(0),
  stockQuantity: z.number().int().min(0),
  shelfLocation: optionalText(50),
  imageUrl,
});

export type ProductInput = z.infer<typeof productInputSchema>;

const amountField = (label: string, required: boolean) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      const n = parseAmount(v ?? null);
      if (n === null) {
        if (!required) return 0;
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is missing or not a number` });
        return z.NEVER;
      }
      if (n < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} cannot be negative` });
        return z.NEVER;
      }
      return toMinor(n);
    });

const intField = (label: string) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v, ctx) => {
      if (v === null || v === undefined || String(v).trim() === "") return 0;
      const n = Number(String(v).replace(/[^\d-]/g, ""));
      if (!Number.isInteger(n) || n < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a whole number ≥ 0` });
        return z.NEVER;
      }
      return n;
    });

/**
 * One CSV row (all strings) → ProductInput. Money columns are in major
 * units as a person would write them ("150000", "12.50").
 */
export const csvRowSchema = z
  .object({
    barcode: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    price: amountField("price", true),
    cost_price: amountField("cost_price", false),
    stock_quantity: intField("stock_quantity"),
    shelf_location: z.string().optional(),
    image_url: z.string().optional(),
  })
  .transform((r) => ({
    barcode: r.barcode,
    name: r.name ?? "",
    description: r.description,
    category: r.category?.trim() || "Other",
    price: r.price,
    costPrice: r.cost_price,
    stockQuantity: r.stock_quantity,
    shelfLocation: r.shelf_location,
    imageUrl: r.image_url,
  }))
  .pipe(productInputSchema);

export const CSV_COLUMNS = [
  "barcode",
  "name",
  "description",
  "category",
  "price",
  "cost_price",
  "stock_quantity",
  "shelf_location",
  "image_url",
] as const;

export const searchHistoryInputSchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  searchType: z.enum(["text", "voice", "barcode", "image"]),
  productId: z.number().int().positive().nullable().optional(),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}
