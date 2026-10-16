"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert, House, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center">
      <CircleAlert className="size-20 text-destructive" aria-hidden />
      <h1 className="mt-6 text-3xl font-extrabold">{t("common.error")}</h1>
      <div className="mt-8 grid w-full gap-3">
        <Button size="xl" onClick={reset}>
          <RefreshCw aria-hidden />
          {t("common.retry")}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">
            <House aria-hidden />
            {t("common.home")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
