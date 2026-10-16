"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { ManualBarcodeForm } from "@/components/scan/manual-barcode-form";
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

  return (
    <>
      <PageHeader title={t("adminScan.title")} backHref="/admin" narrow />
      <main className="mx-auto max-w-xl px-4 pb-10 pt-4">
        <p className="mb-4 text-lg leading-snug text-muted-foreground">{t("adminScan.hint")}</p>

        <BarcodeScanner onDetected={handleCode} busyCode={lookingUp} />

        {failed && (
          <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 p-4 text-lg font-medium text-destructive">
            {t("common.error")}
          </p>
        )}

        <ManualBarcodeForm onSubmit={(code) => void handleCode(code)} className="mt-8" />
      </main>
    </>
  );
}
