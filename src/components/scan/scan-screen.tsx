"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, ScanBarcode, SearchX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cleanBarcode } from "@/lib/barcode";
import { successFeedback } from "@/lib/feedback";
import { useI18n } from "@/i18n/i18n-provider";
import { BarcodeScanner } from "./barcode-scanner";

type Phase = { kind: "scanning" } | { kind: "looking-up"; code: string } | { kind: "not-found"; code: string } | { kind: "failed"; code: string };

export function ScanScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "scanning" });
  const [manual, setManual] = useState("");
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

  const onManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    void lookup(manual);
  };

  const scanAgain = () => {
    setManual("");
    setPhase({ kind: "scanning" });
  };

  return (
    <>
      <PageHeader title={t("scan.title")} backHref="/" />
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        {phase.kind === "scanning" || phase.kind === "looking-up" ? (
          <>
            <p className="mb-4 text-center text-2xl font-bold">{t("scan.hint")}</p>
            <div className="relative">
              <BarcodeScanner onDetected={lookup} />
              {phase.kind === "looking-up" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-black/70 text-white">
                  <LoaderCircle className="size-14 animate-spin" aria-hidden />
                  <p className="text-2xl font-bold tracking-wider">{phase.code}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div role="alert" className="flex flex-col items-center rounded-3xl border-2 border-border bg-card p-6 text-center">
            <SearchX className="size-16 text-destructive" aria-hidden />
            <p className="mt-3 text-2xl font-bold">
              {phase.kind === "failed" ? t("common.error") : t("scan.notFound")}
            </p>
            <p className="mt-2 font-mono text-3xl font-extrabold tracking-wider">{phase.code}</p>
            <div className="mt-6 grid w-full gap-3">
              <Button size="xl" onClick={scanAgain} className="bg-action-scan">
                <ScanBarcode aria-hidden />
                {t("scan.scanAgain")}
              </Button>
              {phase.kind === "not-found" && (
                <Button asChild size="lg" variant="outline">
                  <Link href={`/admin/products/new?barcode=${encodeURIComponent(phase.code)}`}>
                    <Plus aria-hidden />
                    {t("scan.addThis")}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Manual fallback: damaged label, no camera, or a USB scanner */}
        <form onSubmit={onManualSubmit} className="mt-8">
          <label htmlFor="manual-barcode" className="text-xl font-semibold">
            {t("scan.typeBarcode")}
          </label>
          <div className="mt-3 flex gap-3">
            <Input
              id="manual-barcode"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="search"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="893…"
              className="h-16 text-2xl tracking-wider"
            />
            <Button type="submit" size="lg" disabled={!manual.trim()} className="shrink-0">
              {t("scan.find")}
            </Button>
          </div>
        </form>
      </main>
    </>
  );
}
