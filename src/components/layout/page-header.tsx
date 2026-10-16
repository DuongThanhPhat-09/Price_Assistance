"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";
import { hasInAppHistory } from "./navigation-tracker";

/** Sticky header with a large, labelled Back button and the screen title. */
export function PageHeader({
  title,
  backHref,
  right,
}: {
  title: string;
  /** Force Back to a specific page instead of the previous one. */
  backHref?: string;
  right?: ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();

  const goBack = () => {
    if (backHref) router.push(backHref);
    else if (hasInAppHistory()) router.back();
    else router.push("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b-2 border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-3xl items-center gap-3 px-3">
        <Button variant="outline" onClick={goBack} className="shrink-0 px-4" aria-label={t("common.back")}>
          <ArrowLeft aria-hidden />
          <span>{t("common.back")}</span>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold sm:text-2xl">{title}</h1>
        {right}
      </div>
    </header>
  );
}
