/**
 * Public, build-time configuration. Values come from NEXT_PUBLIC_* env vars
 * so they are available both on the server and in the browser.
 */
export type Locale = "vi" | "en";

const rawLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE;

export const appConfig = {
  storeName: process.env.NEXT_PUBLIC_STORE_NAME || "Price Assistant",
  defaultLocale: (rawLocale === "en" ? "en" : "vi") as Locale,
  currency: process.env.NEXT_PUBLIC_CURRENCY || "VND",
  numberLocale: process.env.NEXT_PUBLIC_NUMBER_LOCALE || "vi-VN",
  lowStockThreshold: Number(process.env.NEXT_PUBLIC_LOW_STOCK_THRESHOLD ?? 5) || 5,
} as const;

export const LOCALE_COOKIE = "pa_locale";
export const ADMIN_COOKIE = "pa_admin";

/** BCP-47 language tag passed to the Web Speech API for each UI locale. */
export const speechLangByLocale: Record<Locale, string> = {
  vi: "vi-VN",
  en: "en-US",
};
