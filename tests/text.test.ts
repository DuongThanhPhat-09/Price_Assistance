import { describe, expect, it } from "vitest";
import { editDistance, normalizeText, stripFillerWords, tokenize } from "@/lib/text";

describe("normalizeText", () => {
  it("removes Vietnamese accents and lowercases", () => {
    expect(normalizeText("Ống nước PVC Bình Minh")).toBe("ong nuoc pvc binh minh");
    expect(normalizeText("Đèn LED âm trần")).toBe("den led am tran");
  });

  it("splits letters from digits", () => {
    expect(normalizeText("Ổ cắm A12")).toBe("o cam a 12");
    expect(normalizeText("phi27")).toBe("phi 27");
  });

  it("maps the diameter symbol to 'phi'", () => {
    expect(normalizeText("Ống Ø27")).toBe("ong phi 27");
  });

  it("keeps decimals together", () => {
    expect(tokenize("Dây CV 2.5mm")).toEqual(["day", "cv", "2.5", "mm"]);
    expect(tokenize("dây 2,5")).toEqual(["day", "2.5"]);
  });
});

describe("stripFillerWords", () => {
  it("drops spoken filler but keeps product words", () => {
    expect(stripFillerWords(tokenize("giá ống nước phi 27 bao nhiêu"))).toEqual(["ong", "nuoc", "phi", "27"]);
  });
  it("never empties the query", () => {
    expect(stripFillerWords(["gia"])).toEqual(["gia"]);
  });
  it("keeps 'co' (elbow fitting)", () => {
    expect(stripFillerWords(tokenize("co phi 27"))).toEqual(["co", "phi", "27"]);
  });
});

describe("editDistance", () => {
  it("counts edits and transpositions", () => {
    expect(editDistance("panasonic", "panasonik")).toBe(1);
    expect(editDistance("rang", "rnag")).toBe(1);
    expect(editDistance("abc", "abc")).toBe(0);
  });
  it("exits early beyond max", () => {
    expect(editDistance("aaaaaa", "bbbbbb", 2)).toBe(3);
  });
});
