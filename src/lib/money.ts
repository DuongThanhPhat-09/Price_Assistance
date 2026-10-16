import { appConfig } from "./config";

/**
 * Prices are stored as integer minor units (đồng, cents…). These helpers
 * convert between what humans type ("12.50", "150000") and what we store.
 */

function fractionDigitsFor(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export const FRACTION_DIGITS = fractionDigitsFor(appConfig.currency);
const FACTOR = 10 ** FRACTION_DIGITS;

/** Human amount (major units) → stored integer (minor units). */
export function toMinor(major: number): number {
  return Math.round(major * FACTOR);
}

/** Stored integer (minor units) → human amount (major units). */
export function toMajor(minor: number): number {
  return minor / FACTOR;
}

/**
 * Parses what a person typed or what a CSV contains into major units.
 * Accepts "150000", "150.000", "150,000", "12.50", "12,50", "150.000 ₫".
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = input.trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const lastSep = Math.max(lastDot, lastComma);

  if (lastSep !== -1) {
    const decimals = s.length - lastSep - 1;
    const sepChar = s[lastSep];
    const sameSepCount = s.split(sepChar).length - 1;
    // The last separator is a decimal point when it appears once and is
    // followed by no more digits than the currency has minor units
    // ("12.50", "1,234.50", "1.234,50"). Otherwise it groups thousands.
    const isDecimal = FRACTION_DIGITS > 0 && sameSepCount === 1 && decimals > 0 && decimals <= FRACTION_DIGITS;
    if (isDecimal) {
      s = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
    } else {
      s = s.replace(/[.,]/g, "");
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const currencyFormatter = new Intl.NumberFormat(appConfig.numberLocale, {
  style: "currency",
  currency: appConfig.currency,
  maximumFractionDigits: FRACTION_DIGITS,
});

const plainFormatter = new Intl.NumberFormat(appConfig.numberLocale, {
  maximumFractionDigits: FRACTION_DIGITS,
});

/** Formats stored minor units for display, e.g. 150000 → "150.000 ₫". */
export function formatMoney(minor: number): string {
  return currencyFormatter.format(toMajor(minor));
}

/** Formats major units without currency symbol (used in form inputs). */
export function formatAmountPlain(minor: number): string {
  return plainFormatter.format(toMajor(minor));
}
