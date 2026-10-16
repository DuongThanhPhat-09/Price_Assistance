import { z } from "zod";
import { cleanBarcode } from "./barcode";
import { parseAmount, toMinor } from "./money";

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : ""))
    .pipe(z.string().max(max))
    .transform((v) => (v === "" ? null : v));

/**
 * Like optionalText, but a missing field stays `undefined` ("leave as is")
 * instead of becoming null. Used for fields added later, so a CSV without
 * that column — or an older client — never wipes existing values.
 */
const keepableText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "string" ? v.trim() : v))
    .pipe(z.union([z.string().max(max), z.null(), z.undefined()]))
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
  brand: keepableText(100),
  model: keepableText(100),
  variant: keepableText(100),
});

export type ProductInput = z.infer<typeof productInputSchema>;
/** What the client sends (before trimming / defaults). */
export type ProductInputPayload = z.input<typeof productInputSchema>;

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
    brand: z.string().optional(),
    model: z.string().optional(),
    variant: z.string().optional(),
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
    brand: r.brand,
    model: r.model,
    variant: r.variant,
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
  "brand",
  "model",
  "variant",
] as const;

export const searchHistoryInputSchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  searchType: z.enum(["text", "voice", "barcode", "image"]),
  productId: z.number().int().positive().nullable().optional(),
});

/** Saving a product from a recognised photo. */
export const recognitionSaveSchema = productInputSchema.extend({
  /** Owner-confirmed estimated market price (minor units); null = none. */
  estimatedPrice: z.number().int().min(0).nullable().optional(),
  /** Owner ticked "I checked these details" — required for low confidence. */
  reviewed: z.boolean().optional().default(false),
});

export const recognitionLinkSchema = z.object({
  productId: z.number().int().positive(),
});

const modelName = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .pipe(z.string().max(100).regex(/^[\w.:\-/]*$/, "Model name can only contain letters, numbers and . : - / _"))
  .transform((v) => v || null);

/**
 * API key change: omitted = keep, "" or null = remove the saved key,
 * a string = save this key.
 */
const apiKeyChange = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : v))
  .pipe(z.union([z.string().max(500), z.null(), z.undefined()]));

export const aiSettingsInputSchema = z.object({
  provider: z.enum(["openai", "gemini"]),
  openaiModel: modelName,
  geminiModel: modelName,
  openaiApiKey: apiKeyChange,
  geminiApiKey: apiKeyChange,
  /** Tried in order when the main model fails. Omitted = none. */
  fallbacks: z
    .array(
      z.object({
        /** Existing row id, so the row keeps its saved key. */
        id: z.string().max(64).optional(),
        provider: z.enum(["openai", "gemini"]),
        model: modelName.pipe(z.string({ invalid_type_error: "Enter a model name" }).min(1, "Enter a model name")),
        /** Own key for this row: omitted = keep, "" = remove (use the provider's key). */
        apiKey: apiKeyChange,
      }),
    )
    .max(3, "At most 3 fallback models")
    .optional()
    .default([]),
});

export type AISettingsInput = z.infer<typeof aiSettingsInputSchema>;
export type AISettingsPayload = z.input<typeof aiSettingsInputSchema>;

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}
