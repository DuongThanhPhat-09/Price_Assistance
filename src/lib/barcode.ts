/** Barcode helpers (EAN-13 / EAN-8 / UPC-A check digits). */

export function cleanBarcode(input: string): string {
  return input.replace(/\s+/g, "").trim();
}

/** GS1 check digit for the given digits (without the check digit). */
export function gs1CheckDigit(digits: string): number {
  let sum = 0;
  const rev = digits.split("").reverse();
  rev.forEach((ch, i) => {
    sum += Number(ch) * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10;
}

export function isValidGs1(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const body = code.slice(0, -1);
  return gs1CheckDigit(body) === Number(code.at(-1));
}

/** Builds a valid EAN-13 from a 12-digit body. */
export function makeEan13(body12: string): string {
  if (!/^\d{12}$/.test(body12)) throw new Error("EAN-13 body must be 12 digits");
  return body12 + gs1CheckDigit(body12);
}
