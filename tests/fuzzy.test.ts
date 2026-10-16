import { describe, expect, it } from "vitest";
import { buildDemoProducts } from "../prisma/demo-products";
import { buildIndex, fuzzySearch, pickConfidentMatch } from "@/lib/search/fuzzy";

const products = buildDemoProducts();
const index = buildIndex(products, (p) => p);
const names = (q: string, n = 5) => fuzzySearch(index, q, n).map((r) => r.item.name);

describe("fuzzySearch on the demo catalogue", () => {
  it("has at least 100 demo products", () => {
    expect(products.length).toBeGreaterThanOrEqual(100);
  });

  it("prefix 'pan' finds Panasonic products", () => {
    const top = names("pan", 5);
    expect(top.length).toBe(5);
    for (const n of top) expect(n).toMatch(/Panasonic/);
  });

  it("accent-free voice text finds the phi 27 pipes", () => {
    const res = fuzzySearch(index, "Ong nuoc phi 27", 10);
    // Two brands stock this size → both on top, and the user is asked to pick.
    expect(res.slice(0, 2).map((r) => r.item.name)).toEqual([
      "Ống nước PVC Bình Minh phi 27 (cây 4m)",
      "Ống nước PVC Tiền Phong phi 27 (cây 4m)",
    ]);
    expect(pickConfidentMatch(res)).toBeNull();
  });

  it("a specific spoken name opens the product directly", () => {
    const res = fuzzySearch(index, "ong nuoc binh minh phi 27", 10);
    expect(pickConfidentMatch(res)?.name).toBe("Ống nước PVC Bình Minh phi 27 (cây 4m)");
    expect(pickConfidentMatch(fuzzySearch(index, "van khoa 27"))?.name).toBe("Van khoá nước tay gạt bằng đồng phi 27");
  });

  it("numbers must match exactly: 27 never returns phi 21 first", () => {
    expect(names("ong nuoc phi 27", 3).every((n) => n.includes("27"))).toBe(true);
  });

  it("tolerates typos", () => {
    expect(names("panasonik quat", 1)[0]).toMatch(/Quạt.*Panasonic/);
  });

  it("ignores spoken filler words", () => {
    expect(names("giá bóng đèn led rạng đông 9W bao nhiêu", 1)[0]).toBe("Bóng đèn LED bulb Rạng Đông 9W");
  });

  it("exact barcode wins outright", () => {
    const target = products[42];
    const res = fuzzySearch(index, target.barcode, 5);
    expect(res[0].item.barcode).toBe(target.barcode);
    expect(res[0].score).toBe(1000);
  });

  it("matches by category words", () => {
    expect(names("cong tac", 3).length).toBe(3);
  });

  it("returns nothing for gibberish", () => {
    expect(names("xyzqwv")).toEqual([]);
  });
});

describe("pickConfidentMatch", () => {
  it("returns null for ambiguous results", () => {
    expect(
      pickConfidentMatch([
        { item: "a", score: 10 },
        { item: "b", score: 9.5 },
      ]),
    ).toBeNull();
  });
  it("returns the only result", () => {
    expect(pickConfidentMatch([{ item: "a", score: 1 }])).toBe("a");
  });
});
