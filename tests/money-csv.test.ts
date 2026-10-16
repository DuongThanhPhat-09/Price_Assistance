import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isValidGs1, makeEan13 } from "@/lib/barcode";
import { parseProductCsv, productsToCsv } from "@/lib/csv";
import { formatMoney, parseAmount } from "@/lib/money";

describe("money (VND)", () => {
  it("parses human-typed amounts", () => {
    expect(parseAmount("150000")).toBe(150000);
    expect(parseAmount("150.000")).toBe(150000);
    expect(parseAmount("150,000")).toBe(150000);
    expect(parseAmount("1.650.000 ₫")).toBe(1650000);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("formats with the currency symbol", () => {
    expect(formatMoney(45000).replace(/\s/g, " ")).toMatch(/45\.000/);
  });
});

describe("barcode", () => {
  it("builds valid EAN-13 codes", () => {
    const code = makeEan13("893456700001");
    expect(code).toHaveLength(13);
    expect(isValidGs1(code)).toBe(true);
    expect(isValidGs1("8934567000010")).toBe(code === "8934567000010");
  });
});

describe("CSV import", () => {
  it("parses the bundled sample file without errors", () => {
    const text = readFileSync("public/sample-products.csv", "utf8");
    const { rows, failed } = parseProductCsv(text);
    expect(failed).toEqual([]);
    expect(rows.length).toBe(11);
    expect(rows[0].input.name).toMatch(/Bình Minh/);
    expect(rows[0].input.price).toBe(38000);
    expect(rows.at(-1)!.input.barcode).toBeNull();
  });

  it("reports bad rows with spreadsheet row numbers", () => {
    const text = "name,price,category\nGood,1000,A\n,2000,A\nBad price,abc,A\n";
    const { rows, failed } = parseProductCsv(text);
    expect(rows).toHaveLength(1);
    expect(failed.map((f) => f.row)).toEqual([3, 4]);
  });

  it("accepts friendly header spellings", () => {
    const text = "Name,Price,Cost Price,Stock Quantity,Category\nX,5000,4000,7,Y\n";
    const { rows } = parseProductCsv(text);
    expect(rows[0].input).toMatchObject({ costPrice: 4000, stockQuantity: 7 });
  });

  it("rejects a file without required headers", () => {
    const { rows, failed } = parseProductCsv("foo,bar\n1,2\n");
    expect(rows).toHaveLength(0);
    expect(failed[0].row).toBe(1);
  });

  it("round-trips export → import", () => {
    const csv = productsToCsv([
      {
        id: 1,
        barcode: "8934567000017",
        name: 'Ống "đặc biệt", phi 27',
        description: null,
        category: "Ống nước PVC",
        price: 45000,
        costPrice: 33000,
        stockQuantity: 12,
        shelfLocation: "A1-02",
        imageUrl: null,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    const { rows, failed } = parseProductCsv(csv);
    expect(failed).toEqual([]);
    expect(rows[0].input).toMatchObject({ name: 'Ống "đặc biệt", phi 27', price: 45000, costPrice: 33000 });
  });
});
