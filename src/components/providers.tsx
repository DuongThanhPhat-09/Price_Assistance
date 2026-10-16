"use client";

import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { I18nProvider } from "@/i18n/i18n-provider";
import { NavigationTracker } from "@/components/layout/navigation-tracker";
import { useSettingsStore } from "@/store/settings-store";
import type { Locale } from "@/lib/config";

function StoreHydrator() {
  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
  }, []);
  return null;
}

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <I18nProvider locale={locale}>
      <StoreHydrator />
      <NavigationTracker />
      {children}
      <Toaster
        position="top-center"
        richColors
        toastOptions={{ style: { fontSize: "1.125rem", padding: "1rem 1.25rem" } }}
      />
    </I18nProvider>
  );
}
