"use client";

import Link from "next/link";
import { Camera, History, PackageSearch } from "lucide-react";
import { CameraLookupButton } from "@/components/camera/camera-button";
import { useI18n } from "@/i18n/i18n-provider";

/**
 * Customer mode. One job: photo → product → price. The camera button is
 * the whole screen; History and Manage Products are the only other ways out.
 */
export function HomeScreen() {
  const { t } = useI18n();

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 sm:justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
      {/* For screen readers only: the camera button says it all. */}
      <h1 className="sr-only">{t("home.title")}</h1>

      {/* The one main action — fills the free space on any phone. */}
      <CameraLookupButton className="flex min-h-64 w-full flex-1 flex-col items-center justify-center gap-4 rounded-[2rem] bg-action-camera px-6 py-8 text-white shadow-xl ring-4 ring-action-camera/25 transition-transform active:scale-[0.98] sm:max-h-[26rem]">
        <span className="flex size-32 items-center justify-center rounded-full bg-white/20">
          <Camera className="size-20" strokeWidth={2.25} aria-hidden />
        </span>
        <span className="text-[2.5rem] font-black leading-none">{t("home.camera")}</span>
      </CameraLookupButton>

      <nav aria-label={t("home.more")} className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href="/history"
          className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border bg-card px-2 py-3 text-center text-xl font-bold leading-tight shadow-sm hover:border-primary active:bg-accent"
        >
          <History className="size-9 text-primary" aria-hidden />
          {t("home.history")}
        </Link>
        <Link
          href="/admin"
          className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border bg-card px-2 py-3 text-center text-xl font-bold leading-tight shadow-sm hover:border-primary active:bg-accent"
        >
          <PackageSearch className="size-9 text-primary" aria-hidden />
          {t("home.manage")}
        </Link>
      </nav>
    </main>
  );
}
