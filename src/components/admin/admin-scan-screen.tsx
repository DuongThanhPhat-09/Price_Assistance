"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cleanBarcode } from "@/lib/barcode";
import { successFeedback } from "@/lib/feedback";
import { useI18n } from "@/i18n/i18n-provider";

/**
 * Stock-taking loop for the owner: scan → Add form (new barcode) or Edit
 * form (known barcode) → Save → back here with the camera on again.
 * Navigation uses push so the form's "done" (history back) returns here.
 */
export function AdminScanScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [lookingUp, setLookingUp] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState("");
  const busy = useRef(false);

  const handleCode = useCallback(
    async (raw: string) => {
      const code = cleanBarcode(raw);
      if (!code || busy.current) return;
      busy.current = true;
      setFailed(false);
      setLookingUp(code);
      try {
        const existing = await api.byBarcode(code);
        successFeedback();
        router.push(
          existing
            ? `/admin/products/${existing.id}/edit?from=scan`
            : `/admin/products/new?barcode=${encodeURIComponent(code)}&from=scan`,
        );
        return; // leaving this screen
      } catch {
        setFailed(true);
      }
      setLookingUp(null);
      busy.current = false;
    },
    [router],
  );

  const onManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleCode(manual);
  };

  return (
    <>
      <PageHeader title={t("adminScan.title")} backHref="/admin" />
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        <p className="mb-4 text-lg leading-snug text-muted-foreground">{t("adminScan.hint")}</p>

        <div className="relative">
          <BarcodeScanner onDetected={handleCode} />
          {lookingUp && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-black/70 text-white">
              <LoaderCircle className="size-14 animate-spin" aria-hidden />
              <p className="text-2xl font-bold tracking-wider">{lookingUp}</p>
            </div>
          )}
        </div>

        {failed && (
          <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-4 text-lg text-destructive">
            {t("common.error")}
          </p>
        )}

        <form onSubmit={onManualSubmit} className="mt-8">
          <label htmlFor="admin-manual-barcode" className="text-xl font-semibold">
            {t("scan.typeBarcode")}
          </label>
          <div className="mt-3 flex gap-3">
            <Input
              id="admin-manual-barcode"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="go"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
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
