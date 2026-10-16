"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ScanBarcode, SearchX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { cleanBarcode } from "@/lib/barcode";
import { successFeedback } from "@/lib/feedback";
import { useI18n } from "@/i18n/i18n-provider";
import { BarcodeScanner } from "./barcode-scanner";
import { ManualBarcodeForm } from "./manual-barcode-form";

type Phase =
  | { kind: "scanning" }
  | { kind: "looking-up"; code: string }
  | { kind: "not-found"; code: string }
  | { kind: "failed"; code: string };

export function ScanScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "scanning" });
  const busy = useRef(false);

  const lookup = useCallback(
    async (raw: string) => {
      const code = cleanBarcode(raw);
      if (!code || busy.current) return;
      busy.current = true;
      setPhase({ kind: "looking-up", code });
      try {
        const product = await api.byBarcode(code);
        if (product) {
          successFeedback();
          api.recordSearch(code, "barcode", product.id);
          // No confirmation step: go straight to the product card.
          router.replace(`/product/${product.id}`);
          return; // keep busy=true; this screen is going away
        }
        api.recordSearch(code, "barcode", null);
        setPhase({ kind: "not-found", code });
      } catch {
        setPhase({ kind: "failed", code });
      }
      busy.current = false;
    },
    [router],
  );

  const showCamera = phase.kind === "scanning" || phase.kind === "looking-up";

  return (
    <>
      <PageHeader title={t("scan.title")} backHref="/" narrow />
      <main className="mx-auto max-w-xl px-4 pb-10 pt-4">
        {showCamera ? (
          <>
            <p className="mb-4 text-center text-2xl font-bold leading-snug">{t("scan.hint")}</p>
            <BarcodeScanner onDetected={lookup} busyCode={phase.kind === "looking-up" ? phase.code : null} />
          </>
        ) : (
          <section role="alert" className="rounded-3xl border-2 border-border bg-card p-6 text-center">
            <SearchX className="mx-auto size-16 text-destructive" aria-hidden />
            <p className="mt-3 text-2xl font-bold leading-snug">
              {phase.kind === "failed" ? t("common.error") : t("scan.notFound")}
            </p>
            <p className="mt-2 break-all font-mono text-3xl font-extrabold tracking-wider">{phase.code}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button size="xl" onClick={() => setPhase({ kind: "scanning" })} className="w-full bg-action-scan">
                <ScanBarcode aria-hidden />
                {t("scan.scanAgain")}
              </Button>
              {phase.kind === "not-found" && (
                <Button asChild variant="outline" className="h-auto min-h-16 w-full whitespace-normal px-4 py-3">
                  <Link href={`/admin/products/new?barcode=${encodeURIComponent(phase.code)}&from=scan`}>
                    <Plus aria-hidden />
                    {t("scan.addThis")}
                  </Link>
                </Button>
              )}
            </div>
          </section>
        )}

        <ManualBarcodeForm onSubmit={(code) => void lookup(code)} className="mt-8" />
      </main>
    </>
  );
}
