"use client";

import Link from "next/link";
import { House, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center">
      <PackageSearch className="size-20 text-muted-foreground" aria-hidden />
      <h1 className="mt-6 text-3xl font-extrabold">{t("product.notFound")}</h1>
      <Button asChild size="xl" className="mt-8 w-full">
        <Link href="/">
          <House aria-hidden />
          {t("common.home")}
        </Link>
      </Button>
    </main>
  );
}
