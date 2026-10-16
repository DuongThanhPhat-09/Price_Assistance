import { describe, expect, it } from "vitest";
import { compactCode, decideLookup, nameSimilarity, rankProductMatches, scoreProductMatch } from "@/lib/recognition/matching";

const socket = {
  id: 1,
  name: "Ổ cắm đôi Panasonic Wide WEG15929",
  brand: "Panasonic",
  model: "WEG15929",
  barcode: "8934567000017",
};
const sibling = { id: 2, name: "Ổ cắm đơn Panasonic Wide WEG15919", brand: "Panasonic", model: "WEG15919", barcode: null };
const pipe = { id: 3, name: "Ống nước PVC Bình Minh phi 27", brand: "Bình Minh", model: null, barcode: null };

describe("product matching", () => {
  it("treats the same barcode as a certain match", () => {
    const m = scoreProductMatch({ name: "anything", barcode: "8934567000017" }, socket);
    expect(m).toEqual({ score: 1, reasons: ["barcode"] });
  });

  it("matches by model number even when the name is worded differently", () => {
    const m = scoreProductMatch({ name: "Panasonic double socket", brand: "Panasonic", model: "WEG-15929" }, socket);
    expect(m.score).toBeGreaterThanOrEqual(0.9);
    expect(m.reasons[0]).toBe("model");
  });

  it("finds the model inside the name when the product has no model field", () => {
    const m = scoreProductMatch({ name: "Ổ cắm", brand: "Panasonic", model: "WEG15929" }, { ...socket, model: null });
    expect(m.score).toBeGreaterThanOrEqual(0.9);
  });

  it("never lets a different model of the same series look like a match", () => {
    const m = scoreProductMatch(
      { name: "Ổ cắm đôi Panasonic Wide WEG15929", brand: "Panasonic", model: "WEG15929" },
      sibling,
    );
    expect(m.score).toBeLessThan(0.6);
  });

  it("scores near-identical names highly, accent-insensitively", () => {
    expect(nameSimilarity("Ong nuoc PVC Binh Minh phi 27", pipe.name)).toBeGreaterThan(0.9);
    expect(nameSimilarity("Ống nước PVC Bình Minh phi 21", pipe.name)).toBeLessThan(0.9); // 21 ≠ 27
  });

  it("does not match unrelated products", () => {
    expect(scoreProductMatch({ name: "Bóng đèn LED Rạng Đông 9W", brand: "Rạng Đông" }, pipe).score).toBeLessThan(0.3);
  });

  it("ranks, de-duplicates and drops weak candidates", () => {
    const ranked = rankProductMatches({ name: "Ổ cắm đôi Panasonic WEG15929", brand: "Panasonic", model: "WEG15929" }, [
      pipe,
      sibling,
      socket,
      socket,
    ]);
    expect(ranked.map((r) => r.product.id)).toEqual([1]);
  });

  it("compacts model codes", () => {
    expect(compactCode("WEG-6801 W")).toBe("weg6801w");
  });
});

describe("lookup decision", () => {
  const m = (id: number, score: number, reasons: ("barcode" | "model" | "name" | "brand")[] = ["name"]) => ({
    product: { id },
    score,
    reasons,
  });

  it("opens the product when exactly one match is above 90%", () => {
    expect(decideLookup([m(1, 0.95, ["model"]), m(2, 0.7)])).toEqual({ kind: "existing", productId: 1 });
  });

  it("treats exactly 90% as not confident enough", () => {
    expect(decideLookup([m(1, 0.9)])).toEqual({ kind: "new" });
  });

  it("asks which one when several products are above 90%", () => {
    expect(decideLookup([m(1, 0.95, ["model"]), m(2, 0.95, ["model"])])).toEqual({ kind: "choose", productIds: [1, 2] });
  });

  it("always opens a barcode match", () => {
    expect(decideLookup([m(1, 1, ["barcode"]), m(2, 0.95, ["model"])])).toEqual({ kind: "existing", productId: 1 });
  });

  it("starts the new-product flow when nothing matches", () => {
    expect(decideLookup([])).toEqual({ kind: "new" });
    expect(decideLookup([m(1, 0.75)])).toEqual({ kind: "new" });
  });
});
