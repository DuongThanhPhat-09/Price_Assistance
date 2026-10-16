"use client";

import Link from "next/link";
import { Mic, ScanBarcode, Search } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";

/**
 * Fixed bottom bar on result screens so checking the *next* product is
 * always one tap away — same colours as the home screen cards.
 */
export function QuickActionBar() {
  const { t } = useI18n();
  const items = [
    { href: "/scan", label: t("nav.scan"), icon: ScanBarcode, color: "bg-action-scan" },
    { href: "/voice", label: t("nav.voice"), icon: Mic, color: "bg-action-voice" },
    { href: "/search", label: t("nav.search"), icon: Search, color: "bg-action-search" },
  ];

  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2 px-4 py-2">
        {items.map(({ href, label, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-[4.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-base font-bold leading-tight text-white active:scale-[0.98] sm:flex-row sm:gap-2 sm:text-lg",
              color,
            )}
          >
            <Icon className="size-7 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Spacer so content is never hidden behind the fixed bar. */
export function QuickActionBarSpacer() {
  return <div aria-hidden className="h-28 pb-[env(safe-area-inset-bottom)]" />;
}
