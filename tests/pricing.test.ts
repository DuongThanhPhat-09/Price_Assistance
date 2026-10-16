import { describe, expect, it } from "vitest";
import { collectPriceSuggestions, type PriceQuery, type PriceSource } from "@/server/pricing";
import { aiEstimateSource } from "@/server/pricing/ai-estimate";

const query: PriceQuery = {
  name: "Ổ cắm đôi Panasonic Wide WEG15929",
  brand: "Panasonic",
  model: "WEG15929",
  variant: null,
  category: "Ổ cắm",
  barcode: null,
  estimatedPrice: 85_000,
};

const source = (id: PriceSource["id"], suggest: PriceSource["suggest"], enabled = true): PriceSource => ({
  id,
  isEnabled: () => enabled,
  suggest,
});

describe("price suggestions", () => {
  it("returns the AI estimate labelled as an AI guess", async () => {
    const [s] = await collectPriceSuggestions(query, undefined, [aiEstimateSource]);
    expect(s).toMatchObject({ source: "ai_estimate", kind: "ai", amount: 85_000 });
  });

  it("returns nothing when the AI could not estimate a price", async () => {
    expect(await collectPriceSuggestions({ ...query, estimatedPrice: null }, undefined, [aiEstimateSource])).toEqual([]);
  });

  it("drops failing and disabled sources without failing the lookup", async () => {
    const broken = source("ecommerce", async () => {
      throw new Error("down");
    });
    const off = source("supplier", async () => [], false);
    const result = await collectPriceSuggestions(query, undefined, [aiEstimateSource, broken, off]);
    expect(result.map((r) => r.source)).toEqual(["ai_estimate"]);
  });
});
