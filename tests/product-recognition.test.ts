import { describe, expect, it } from "vitest";
import {
  buildProductRecognitionPrompt,
  parseProductRecognition,
  PRODUCT_RECOGNITION_SCHEMA,
  roundEstimatedPrice,
} from "@/server/ai/tasks/product-recognition";
import { toGeminiSchema } from "@/server/ai/vision/json-schema";
import { VisionProviderError } from "@/server/ai/vision/types";

const answer = {
  visible_text: ["Panasonic", "Wide Series", "WEG15929", "16A 250V~"],
  is_product: true,
  brand: "Panasonic",
  model: "WEG15929",
  variant: "Trắng, 16A",
  name: "Ổ cắm đôi Panasonic Wide WEG15929",
  category: "Ổ cắm",
  category_alternatives: ["Thiết bị điện", "ổ cắm"],
  description: "Ổ cắm đôi có màn che, 16A 250V.",
  barcode: "8934567000017",
  keywords: ["Panasonic", "WEG15929", "Wide Series", "panasonic"],
  estimated_price: 87_400,
  confidence: 0.92,
};

describe("parseProductRecognition", () => {
  it("normalises a good answer", () => {
    const r = parseProductRecognition(answer);
    expect(r).toMatchObject({
      isProduct: true,
      name: "Ổ cắm đôi Panasonic Wide WEG15929",
      brand: "Panasonic",
      model: "WEG15929",
      category: "Ổ cắm",
      barcode: "8934567000017",
      estimatedPrice: 87_000, // VND rounded to the nearest 1,000
      confidence: 0.92,
    });
    // The main category is not repeated as an alternative; keywords de-duplicated.
    expect(r.categoryAlternatives).toEqual(["Thiết bị điện"]);
    expect(r.keywords).toEqual(["Panasonic", "WEG15929", "Wide Series"]);
    expect(r.visibleText).toHaveLength(4);
  });

  it("drops barcode digits that fail the check digit (likely misread)", () => {
    expect(parseProductRecognition({ ...answer, barcode: "8934567000018" }).barcode).toBeNull();
  });

  it("accepts confidence given in percent and prices given as text", () => {
    const r = parseProductRecognition({ ...answer, confidence: 85, estimated_price: "250.000" });
    expect(r.confidence).toBe(0.85);
    expect(r.estimatedPrice).toBe(250_000);
  });

  it("caps confidence when the photo is not a product, zero without a name", () => {
    expect(parseProductRecognition({ ...answer, is_product: false }).confidence).toBeLessThanOrEqual(0.3);
    expect(parseProductRecognition({ ...answer, name: "" }).confidence).toBe(0);
  });

  it("tolerates missing and odd fields", () => {
    const r = parseProductRecognition({ name: "Thing", category: "Other", brand: "null", estimated_price: -5 });
    expect(r).toMatchObject({ name: "Thing", brand: null, model: null, estimatedPrice: null, keywords: [], confidence: 0 });
  });

  it("rejects answers that are not objects", () => {
    expect(() => parseProductRecognition("nope")).toThrow(VisionProviderError);
    expect(() => parseProductRecognition(null)).toThrow(VisionProviderError);
  });
});

describe("roundEstimatedPrice", () => {
  it("rounds VND to prices a shop would use", () => {
    expect(roundEstimatedPrice(249_600)).toBe(250_000);
    expect(roundEstimatedPrice(4_430)).toBe(4_400);
    expect(roundEstimatedPrice(0)).toBeNull();
    expect(roundEstimatedPrice(null)).toBeNull();
  });
});

describe("prompt", () => {
  it("targets the shop's market, language and existing categories", () => {
    const { instructions, prompt } = buildProductRecognitionPrompt({ locale: "vi", categories: ["Ổ cắm", "Ống nước PVC"] });
    expect(instructions).toContain("Vietnam");
    expect(instructions).toContain("VND");
    expect(instructions).toContain("Vietnamese");
    expect(prompt).toContain('"Ổ cắm"');
  });
});

describe("schema", () => {
  it("is valid for OpenAI strict mode: every property is required", () => {
    if (PRODUCT_RECOGNITION_SCHEMA.type !== "object") throw new Error("expected object");
    expect([...PRODUCT_RECOGNITION_SCHEMA.required].sort()).toEqual(Object.keys(PRODUCT_RECOGNITION_SCHEMA.properties).sort());
  });

  it("converts to Gemini's schema format, keeping field order", () => {
    const g = toGeminiSchema(PRODUCT_RECOGNITION_SCHEMA);
    expect(g.type).toBe("OBJECT");
    expect(g.propertyOrdering?.[0]).toBe("visible_text");
    expect(g.properties?.brand).toMatchObject({ type: "STRING", nullable: true });
    expect(g.properties?.keywords).toMatchObject({ type: "ARRAY", items: { type: "STRING" } });
    expect(g.properties?.confidence).toMatchObject({ type: "NUMBER" });
    expect(g.properties?.confidence.nullable).toBeUndefined();
  });
});
