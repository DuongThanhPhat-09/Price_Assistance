"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, Mic, Package, ScanBarcode, ScrollText, Search, Settings, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import type { MessageKey } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: MessageKey; icon: LucideIcon }[] = [
  { href: "/admin", label: "adminTab.products", icon: Package },
  { href: "/admin/scan", label: "adminTab.scan", icon: ScanBarcode },
  { href: "/admin/search", label: "adminTab.search", icon: Search },
  { href: "/admin/voice", label: "adminTab.voice", icon: Mic },
  { href: "/admin/import", label: "adminTab.importExport", icon: FileSpreadsheet },
  { href: "/admin/logs", label: "adminTab.logs", icon: ScrollText },
  { href: "/admin/settings", label: "adminTab.settings", icon: Settings },
];

/**
 * Admin mode: every inventory tool, behind one "Manage Products" entry on
 * the home screen. Tabs scroll sideways on phones and wrap on wide screens.
 */
export function AdminShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Keep the current tab visible when the row scrolls on a small phone.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <>
      <PageHeader title={t("admin.title")} backHref="/" />
      <nav aria-label={t("admin.title")} className="border-b-2 border-border bg-card">
        <ul className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] md:flex-wrap">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="shrink-0">
                <Link
                  ref={active ? activeRef : undefined}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 items-center gap-2 rounded-xl border-2 px-4 text-lg font-bold whitespace-nowrap",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary active:bg-accent",
                  )}
                >
                  <Icon className="size-6 shrink-0" aria-hidden />
                  {t(label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className={cn("mx-auto px-4 pb-12 pt-6", narrow ? "max-w-xl" : "max-w-3xl")}>{children}</main>
    </>
  );
}
