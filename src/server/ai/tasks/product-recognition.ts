import "server-only";
import { z } from "zod";
import { isValidGs1 } from "@/lib/barcode";
import { appConfig, type Locale } from "@/lib/config";
import { FRACTION_DIGITS, parseAmount, toMinor } from "@/lib/money";
import type { RecognizedProductDTO } from "@/lib/types";
import type { JsonSchema } from "../vision/json-schema";
import {
  VisionProviderError,
  type VisionAttempt,
  type VisionImage,
  type VisionProvider,
  type VisionProviderId,
} from "../vision/types";

/**
 * Task: one product photo → catalogue-ready product data.
 *
 * Owns the prompt, the output schema and the clean-up of the answer; it
 * works with any VisionProvider. New camera features (invoices, shelves,
 * stock counting) follow the same pattern in their own task file.
 */

const nullableString = (description: string): JsonSchema => ({ type: ["string", "null"], description });
const stringList = (description: string): JsonSchema => ({ type: "array", items: { type: "string" }, description });

/** Order matters: the model reads the packaging first, then decides. */
export const PRODUCT_RECOGNITION_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    visible_text: stringList("Important text printed on the product/packaging, one item per line, exactly as printed"),
    is_product: { type: "boolean", description: "False if the photo does not show a sellable product" },
    brand: nullableString("Brand / manufacturer exactly as printed, or null"),
    model: nullableString("Model or part number exactly as printed, or null. Never invent one"),
    variant: nullableString("Colour, size, capacity, rating or pack size that distinguishes this item, or null"),
    name: { type: "string", description: "Concise catalogue name for the shop" },
    category: { type: "string", description: "Best category for this product" },
    category_alternatives: stringList("Up to 3 other plausible categories"),
    description: nullableString("1–2 short factual sentences with useful specs, or null"),
    barcode: nullableString("Digits under the barcode if completely legible, else null"),
    keywords: stringList("3–8 short keywords: brand, series, model, key specs"),
    estimated_price: { type: ["number", "null"], description: "Typical retail price of one unit, number only" },
    confidence: { type: "number", description: "0 to 1: how sure you are this identifies the exact product" },
  },
  required: [
    "visible_text",
    "is_product",
    "brand",
    "model",
    "variant",
    "name",
    "category",
    "category_alternatives",
    "description",
    "barcode",
    "keywords",
    "estimated_price",
    "confidence",
  ],
};

export interface ProductRecognitionContext {
  locale: Locale;
  /** The shop's existing categories, so the AI reuses them instead of inventing near-duplicates. */
  categories: string[];
}

const LANGUAGE: Record<Locale, string> = { vi: "Vietnamese", en: "English" };
const MAX_CATEGORIES_IN_PROMPT = 80;

/** "vi-VN" → "Vietnam"; used so price estimates are for the right market. */
function marketName(): string {
  const region = appConfig.numberLocale.split("-")[1];
  try {
    if (region) return new Intl.DisplayNames(["en"], { type: "region" }).of(region.toUpperCase()) ?? region;
  } catch {
    /* fall through */
  }
  return "the shop's local market";
}

export function buildProductRecognitionPrompt(ctx: ProductRecognitionContext): { instructions: string; prompt: string } {
  const language = LANGUAGE[ctx.locale];
  const market = marketName();
  const currency = appConfig.currency;
  const categories = ctx.categories.slice(0, MAX_CATEGORIES_IN_PROMPT);

  const instructions = [
    `You identify products for a small retail shop in ${market} (household electrical, plumbing, hardware and similar goods).`,
    "The shop owner photographs one product, usually its packaging or label, with a phone. Use OCR and visual recognition together: read every label, logo, model plate and barcode, and use the product's shape when text is missing.",
    "",
    "Rules:",
    "- visible_text: transcribe the important printed text first (brand, series, model, specs, quantity), exactly as printed, without translating.",
    "- brand and model: copy exactly as printed (keep letters, digits and dashes, e.g. \"WEG6801\"). Use null when not visible. Never guess a model number.",
    `- name: what the shop would write on a price tag, in ${language}: product type + brand + series/model + key spec, at most 120 characters. Example: "Ổ cắm đôi Panasonic Wide WEG15929".`,
    `- category: in ${language}. ${
      categories.length
        ? "Pick one of the shop's existing categories whenever one fits; only propose a new short category if none fits."
        : "Propose a short, general category."
    }`,
    `- description: in ${language}, factual specs only, no marketing language.`,
    "- barcode: only if every digit under the barcode is clearly legible.",
    `- estimated_price: a rough typical retail price for ONE unit in ${market}, in ${currency} major units (plain number, no symbols or separators), judged from product type, brand and specs. It is only an estimate; use null if you cannot tell what the product is.`,
    "- confidence: below 0.5 if the photo is blurry, the product is ambiguous or you are mostly guessing; above 0.9 only when brand and model are clearly legible.",
    "- is_product: false for photos that show no sellable product (a person, a room, a blank surface); then give your best guess anyway with low confidence.",
  ].join("\n");

  const prompt = [
    "Identify the product in this photo.",
    categories.length ? `The shop's existing categories: ${categories.map((c) => JSON.stringify(c)).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { instructions, prompt };
}

/* ------------------------------------------------------------------ */
/* Clean-up of the model's answer                                      */
/* ------------------------------------------------------------------ */

const text = (max: number) =>
  z
    .unknown()
    .transform((v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : ""));
const nullableText = (max: number) => text(max).transform((v) => (v && !/^(null|n\/a|unknown)$/i.test(v) ? v : null));
const list = (maxItems: number, maxLen: number) =>
  z
    .unknown()
    .transform((v) => (Array.isArray(v) ? v : []))
    .transform((arr) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const item of arr) {
        const s = typeof item === "string" ? item.replace(/\s+/g, " ").trim().slice(0, maxLen) : "";
        if (!s || seen.has(s.toLowerCase())) continue;
        seen.add(s.toLowerCase());
        out.push(s);
        if (out.length >= maxItems) break;
      }
      return out;
    });
// Strings like "250.000" are read the way the shop writes prices.
const number = z
  .unknown()
  .transform((v) => (typeof v === "number" || typeof v === "string" ? parseAmount(v) : null));
const ratio = z.unknown().transform((v) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
});

const rawOutputSchema = z.object({
  visible_text: list(40, 200),
  is_product: z.unknown().transform((v) => v !== false),
  brand: nullableText(100),
  model: nullableText(100),
  variant: nullableText(100),
  name: text(200),
  category: text(100),
  category_alternatives: list(3, 100),
  description: nullableText(2000),
  barcode: nullableText(32),
  keywords: list(8, 60),
  estimated_price: number,
  confidence: ratio,
});

/** Rounds an estimate to a price a shop would actually use (VND: nearest 1,000). */
export function roundEstimatedPrice(major: number | null): number | null {
  if (major === null || !Number.isFinite(major) || major <= 0) return null;
  let rounded = major;
  if (FRACTION_DIGITS === 0) {
    const step = major >= 10_000 ? 1000 : major >= 1000 ? 100 : 1;
    rounded = Math.max(step, Math.round(major / step) * step);
  }
  return toMinor(rounded);
}

/** Validates and normalises whatever the model returned. Never throws on odd values, only on garbage. */
export function parseProductRecognition(output: unknown): RecognizedProductDTO {
  const parsed = rawOutputSchema.safeParse(output);
  if (!parsed.success || typeof output !== "object" || output === null) {
    throw new VisionProviderError("invalid_response", "The AI answer did not match the expected format");
  }
  const r = parsed.data;

  let confidence = r.confidence ?? 0;
  if (confidence > 1 && confidence <= 100) confidence /= 100; // some models answer in percent
  confidence = Math.min(1, Math.max(0, confidence));
  if (!r.is_product) confidence = Math.min(confidence, 0.3);
  if (!r.name) confidence = 0;

  const digits = r.barcode?.replace(/\D/g, "") ?? "";
  const category = r.category || r.category_alternatives[0] || "";

  return {
    isProduct: r.is_product,
    name: r.name,
    brand: r.brand,
    model: r.model,
    variant: r.variant,
    category,
    categoryAlternatives: r.category_alternatives.filter((c) => c.toLowerCase() !== category.toLowerCase()),
    description: r.description,
    // Only trust digits that pass the GS1 check — a misread digit would
    // otherwise create a product with a wrong barcode.
    barcode: isValidGs1(digits) ? digits : null,
    keywords: r.keywords,
    visibleText: r.visible_text,
    estimatedPrice: roundEstimatedPrice(r.estimated_price),
    confidence: Math.round(confidence * 100) / 100,
  };
}

export async function recognizeProduct(
  provider: VisionProvider,
  image: VisionImage,
  ctx: ProductRecognitionContext,
  signal?: AbortSignal,
): Promise<{ result: RecognizedProductDTO; provider: VisionProviderId; model: string; attempts: VisionAttempt[] }> {
  const { instructions, prompt } = buildProductRecognitionPrompt(ctx);
  const res = await provider.generateStructured({
    task: "product_recognition",
    instructions,
    prompt,
    images: [image],
    schema: PRODUCT_RECOGNITION_SCHEMA,
    signal,
  });
  try {
    return {
      result: parseProductRecognition(res.output),
      provider: res.provider,
      model: res.model,
      attempts: res.attempts ?? [],
    };
  } catch (e) {
    if (e instanceof VisionProviderError && !e.provider) {
      const err = new VisionProviderError(e.code, e.message, res.provider);
      err.attempts = res.attempts;
      throw err;
    }
    throw e;
  }
}
