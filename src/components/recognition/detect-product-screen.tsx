"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Barcode, CircleCheck, Lightbulb, RotateCcw, Settings, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { api, ApiRequestError } from "@/lib/api-client";
import { successFeedback } from "@/lib/feedback";
import { preloadPhotoTools, preparePhoto } from "@/lib/photo";
import type { ProductDTO, RecognitionResponse } from "@/lib/types";
import type { MessageKey } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/i18n-provider";
import { AnalyzingView, type AnalyzePhase } from "./analyzing-view";
import { PhotoPicker } from "./photo-picker";
import { needsSettings, recognitionErrorMessage } from "./recognition-errors";
import { RecognitionReview } from "./recognition-review";

type Step =
  | { name: "capture" }
  | { name: "analyzing"; phase: AnalyzePhase }
  | { name: "review"; data: RecognitionResponse }
  | { name: "error"; message: MessageKey; settingsLink: boolean };

/**
 * Smart Product Recognition: photo → AI → review → save, then straight
 * back to the camera for the next product. `initialBarcode` comes from
 * scan-to-add (unknown barcode → "Fill in from a photo").
 */
export function DetectProductScreen({ initialBarcode, fromScan }: { initialBarcode?: string; fromScan?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "capture" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<ProductDTO | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => preloadPhotoTools(), []);

  // Free the previous preview whenever it changes or the screen closes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPreviewUrl(null);
    setStep({ name: "capture" });
    window.scrollTo({ top: 0 });
  }, []);

  const analyze = async (file: File) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLastSaved(null);
    setPreviewUrl(URL.createObjectURL(file));
    setStep({ name: "analyzing", phase: "prepare" });
    window.scrollTo({ top: 0 });

    try {
      const prepared = await preparePhoto(file);
      if (ac.signal.aborted) return;
      setPreviewUrl(URL.createObjectURL(prepared.photo)); // always displayable (HEIC is not, outside Safari)
      setStep({ name: "analyzing", phase: "upload" });
      const data = await api.recognize(prepared.photo, {
        thumbnail: prepared.thumbnail,
        barcode: initialBarcode || prepared.barcode,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      successFeedback();
      setStep({ name: "review", data });
    } catch (e) {
      if (ac.signal.aborted || (e as Error).name === "AbortError") return;
      if (e instanceof ApiRequestError && e.status === 401) {
        router.push(`/admin/login?next=${encodeURIComponent("/admin/detect")}`);
        return;
      }
      setStep({ name: "error", message: recognitionErrorMessage(e), settingsLink: needsSettings(e) });
    }
  };

  const onSaved = (product: ProductDTO) => {
    toast.success(t("admin.saved"));
    if (fromScan) {
      router.back(); // back to the barcode scanner for the next item
      return;
    }
    setLastSaved(product);
    reset();
  };

  const onUseExisting = async (recognitionId: number, productId: number) => {
    try {
      await api.linkRecognition(recognitionId, productId);
    } catch (e) {
      // Not fatal: the owner still gets to the product they picked.
      console.warn("[detect] link failed", e);
    }
    router.push(`/admin/products/${productId}/edit?from=recognize`);
  };

  return (
    <>
      <PageHeader title={t("detect.title")} backHref={fromScan ? undefined : "/admin"} narrow />
      <main className="mx-auto max-w-xl px-4 pb-10 pt-4">
        {step.name === "capture" && (
          <div className="space-y-6">
            {lastSaved && (
              <div role="status" className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 ring-2 ring-emerald-200">
                <CircleCheck className="mt-0.5 size-7 shrink-0 text-success" aria-hidden />
                <div className="min-w-0 text-lg leading-snug">
                  <p className="font-bold">{t("detect.saved", { name: lastSaved.name })}</p>
                  <p>
                    {t("detect.next")}{" "}
                    <Link href={`/product/${lastSaved.id}`} className="font-semibold text-primary underline">
                      {t("detect.openSaved")}
                    </Link>
                  </p>
                </div>
              </div>
            )}

            <p className="text-lg leading-snug text-muted-foreground">{t("detect.intro")}</p>

            {initialBarcode && (
              <p className="flex items-center gap-3 rounded-2xl bg-accent p-4 text-lg font-medium">
                <Barcode className="size-7 shrink-0 text-primary" aria-hidden />
                {t("detect.barcodeNotice", { code: initialBarcode })}
              </p>
            )}

            <PhotoPicker onPhoto={(f) => void analyze(f)} />

            <section className="rounded-2xl border-2 border-border bg-card p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Lightbulb className="size-6 text-warning" aria-hidden />
                {t("detect.tipsTitle")}
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
                <li>{t("detect.tip1")}</li>
                <li>{t("detect.tip2")}</li>
                <li>{t("detect.tip3")}</li>
              </ul>
            </section>
          </div>
        )}

        {step.name === "analyzing" && <AnalyzingView previewUrl={previewUrl} phase={step.phase} onCancel={reset} />}

        {step.name === "review" && (
          <RecognitionReview
            key={step.data.recognitionId}
            data={step.data}
            previewUrl={previewUrl}
            initialBarcode={initialBarcode}
            onRetake={reset}
            onSaved={onSaved}
            onUseExisting={(pid) => onUseExisting(step.data.recognitionId, pid)}
          />
        )}

        {step.name === "error" && (
          <div className="space-y-5">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={previewUrl} alt="" className="aspect-[4/3] w-full rounded-3xl border-2 border-border bg-white object-contain" />
            )}
            <p role="alert" className="flex gap-3 rounded-2xl bg-destructive/10 p-4 text-lg font-semibold text-destructive">
              <TriangleAlert className="mt-0.5 size-7 shrink-0" aria-hidden />
              {t(step.message)}
            </p>
            {step.settingsLink && (
              <Button asChild size="lg" className="w-full">
                <Link href="/admin/ai-settings">
                  <Settings aria-hidden />
                  {t("detect.openSettings")}
                </Link>
              </Button>
            )}
            <Button size="lg" variant={step.settingsLink ? "outline" : "default"} className="w-full" onClick={reset}>
              <RotateCcw aria-hidden />
              {t("review.retake")}
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
