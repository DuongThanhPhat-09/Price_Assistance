"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { dictionaries, translate, type MessageKey } from "./dictionaries";
import { LOCALE_COOKIE, speechLangByLocale, type Locale } from "@/lib/config";

interface I18nContextValue {
  locale: Locale;
  speechLang: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
  formatDate: (iso: string) => string;
  formatRelative: (iso: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Locale lives in a cookie (not localStorage) so the server renders the
 * right language on the very first paint — no flash of the wrong language.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      router.refresh();
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[locale];
    const intlLocale = locale === "vi" ? "vi-VN" : "en-US";
    const dateFmt = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" });
    const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });

    return {
      locale,
      speechLang: speechLangByLocale[locale],
      t: (key, vars) => translate(dict, key, vars),
      setLocale,
      formatDate: (iso) => dateFmt.format(new Date(iso)),
      formatRelative: (iso) => {
        const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
        const abs = Math.abs(diffSec);
        if (abs < 60) return dict["recent.justNow"];
        if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
        if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
        return rtf.format(Math.round(diffSec / 86400), "day");
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
