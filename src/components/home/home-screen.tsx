"use client";

import Link from "next/link";
import { Languages, Mic, ScanBarcode, Search, Settings, Store } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { useSettingsStore } from "@/store/settings-store";
import { Button } from "@/components/ui/button";
import { ActionCard } from "./action-card";
import { RecentSearches } from "./recent-searches";

export function HomeScreen() {
  const { t, locale, setLocale } = useI18n();
  const storeName = useSettingsStore((s) => s.storeName);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 pb-10 pt-5">
      {/* Top: store name + one-tap language switch */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Store className="size-7" aria-hidden />
          </span>
          <p className="line-clamp-2 text-xl font-bold leading-tight" suppressHydrationWarning>
            {storeName}
          </p>
        </div>
        <Button
          variant="outline"
          className="h-12 shrink-0 px-4 text-base"
          onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
        >
          <Languages className="size-5" aria-hidden />
          {t("common.language")}
        </Button>
      </header>

      <h1 className="mt-8 text-[2rem] font-extrabold leading-tight tracking-tight sm:text-4xl">{t("home.title")}</h1>

      {/* Three giant actions */}
      <nav aria-label={t("home.title")} className="mt-6 grid gap-4 md:grid-cols-3">
        <ActionCard
          href="/scan"
          icon={ScanBarcode}
          label={t("home.scan")}
          hint={t("home.scanHint")}
          className="bg-action-scan"
        />
        <ActionCard
          href="/voice"
          icon={Mic}
          label={t("home.voice")}
          hint={t("home.voiceHint")}
          className="bg-action-voice"
        />
        <ActionCard
          href="/search"
          icon={Search}
          label={t("home.search")}
          hint={t("home.searchHint")}
          className="bg-action-search"
        />
      </nav>

      <RecentSearches />

      <footer className="mt-12 flex justify-center">
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link href="/admin">
            <Settings aria-hidden />
            {t("home.manage")}
          </Link>
        </Button>
      </footer>
    </main>
  );
}
