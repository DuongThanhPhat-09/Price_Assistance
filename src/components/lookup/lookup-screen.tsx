"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, Lightbulb, PackagePlus, SearchX, Settings, TriangleAlert } from "lucide-react";
import { usePhotoInput } from "@/components/camera/camera-button";
import { PageHeader } from "@/components/layout/page-header";
import { ProductImage } from "@/components/product/product-image";
import { AnalyzingView, type AnalyzePhase } from "@/components/recognition/analyzing-view";
import { PhotoPicker } from "@/components/recognition/photo-picker";
import { needsSettings, recognitionErrorMessage } from "@/components/recognition/recognition-errors";
import { RecognitionReview } from "@/components/recognition/recognition-review";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { successFeedback } from "@/lib/feedback";
import { formatMoney } from "@/lib/money";
import { takePendingPhoto } from "@/lib/pending-photo";
import { preloadPhotoTools, preparePhoto } from "@/lib/photo";
import type { ProductMatchDTO, RecognitionResponse, SearchType } from "@/lib/types";
import type { MessageKey } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/i18n-provider";

type Step =
  | { name: "capture" }
  | { name: "analyzing"; phase: AnalyzePhase }
  | { name: "choose"; data: RecognitionResponse; options: ProductMatchDTO[] }
  | { name: "new"; data: RecognitionResponse }
  | { name: "error"; message: MessageKey; settingsLink: boolean };

/**
 * Customer mode: photo → answer.
 *
 *   1. A barcode in the photo is read on the phone and looked up directly
 *      (under a second, no AI needed).
 *   2. Otherwise the AI recognises the product and the server matches it
 *      against the catalogue. One match above 90% opens straight away.
 *   3. Several equally good matches: "Which one is it?" — one tap.
 *   4. No match: "New Product Detected", pre-filled and ready to save.
 */
export function LookupScreen() {
  const { t } = useI18n();
  const router = useRouter();
  // Taken once on mount (the first initializer result is the one React keeps).
  const [initialPhoto] = useState(takePendingPhoto);
  const [step, setStep] = useState<Step>(initialPhoto ? { name: "analyzing", phase: "prepare" } : { name: "capture" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /** Show the product. `replace` so Back from it returns to where the camera was opened. */
  const openProduct = useCallback(
    (productId: number, keyword: string, type: SearchType) => {
      successFeedback();
      api.recordSearch(keyword, type, productId);
      router.replace(`/product/${productId}`);
    },
    [router],
  );

  const analyze = useCallback(
    async (file: File) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setPreviewUrl(URL.createObjectURL(file));
      setStep({ name: "analyzing", phase: "prepare" });
      window.scrollTo({ top: 0 });

      try {
        const prepared = await preparePhoto(file);
        if (ac.signal.aborted) return;
        setPreviewUrl(URL.createObjectURL(prepared.photo)); // always displayable (HEIC is not, outside Safari)

        // Fast path: the photo shows a barcode the shop already knows.
        if (prepared.barcode) {
          const known = await api.byBarcode(prepared.barcode).catch(() => null);
          if (ac.signal.aborted) return;
          if (known) {
            openProduct(known.id, prepared.barcode, "barcode");
            return;
          }
        }

        setStep({ name: "analyzing", phase: "upload" });
        const data = await api.recognize(prepared.photo, {
          thumbnail: prepared.thumbnail,
          barcode: prepared.barcode,
          mode: "lookup",
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;

        const outcome = data.outcome ?? { kind: "new" };
        if (outcome.kind === "existing") {
          openProduct(outcome.productId, data.result.name || "photo", "image");
          return;
        }
        if (outcome.kind === "choose") {
          const options = data.matches.filter((m) => outcome.productIds.includes(m.product.id));
          setStep({ name: "choose", data, options });
          return;
        }
        if (!data.result.isProduct) {
          setStep({ name: "error", message: "lookup.notProduct", settingsLink: false });
          return;
        }
        successFeedback();
        setStep({ name: "new", data });
      } catch (e) {
        if (ac.signal.aborted || (e as Error).name === "AbortError") return;
        setStep({ name: "error", message: recognitionErrorMessage(e), settingsLink: needsSettings(e) });
      }
    },
    [openProduct],
  );

  // Retake opens the camera straight away; cancelling it keeps the current screen.
  const camera = usePhotoInput((file) => void analyze(file));

  useEffect(() => {
    preloadPhotoTools();
    if (initialPhoto) void analyze(initialPhoto);
    return () => abortRef.current?.abort();
  }, [initialPhoto, analyze]);

  const cancel = () => {
    abortRef.current?.abort();
    setPreviewUrl(null);
    setStep({ name: "capture" });
  };

  // "New Product Detected" is the review screen's own banner, so the header stays "Check a price".
  const title = step.name === "choose" ? t("lookup.chooseTitle") : t("lookup.title");

  return (
    <>
      {camera.input}
      <PageHeader title={title} backHref="/" narrow />
      <main className="mx-auto max-w-xl px-4 pb-10 pt-4">
        {step.name === "capture" && (
          <div className="space-y-6">
            <p className="text-center text-2xl font-bold leading-snug">{t("lookup.intro")}</p>
            <PhotoPicker tone="lookup" onPhoto={(f) => void analyze(f)} />
            <section className="rounded-2xl border-2 border-border bg-card p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Lightbulb className="size-6 text-warning" aria-hidden />
                {t("detect.tipsTitle")}
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
                <li>{t("lookup.tip1")}</li>
                <li>{t("detect.tip2")}</li>
                <li>{t("detect.tip3")}</li>
              </ul>
            </section>
          </div>
        )}

        {step.name === "analyzing" && <AnalyzingView previewUrl={previewUrl} phase={step.phase} onCancel={cancel} />}

        {step.name === "choose" && (
          <div className="space-y-5">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={previewUrl} alt="" className="aspect-[4/3] w-full rounded-3xl border-2 border-border bg-white object-contain" />
            )}
            <p className="text-2xl font-bold leading-snug">{t("lookup.chooseHint")}</p>
            <ul className="space-y-3">
              {step.options.map(({ product }) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => openProduct(product.id, step.data.result.name || product.name, "image")}
                    className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card p-3 text-left shadow-sm hover:border-primary active:bg-accent"
                  >
                    <ProductImage
                      src={product.imageUrl}
                      alt=""
                      category={product.category}
                      className="size-24 shrink-0 rounded-xl"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-xl font-bold leading-snug">{product.name}</span>
                      {product.variant && <span className="block text-lg text-muted-foreground">{product.variant}</span>}
                      <span className="block text-3xl font-black text-price">{formatMoney(product.price)}</span>
                    </span>
                    <ChevronRight className="size-8 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="lg"
              className="h-auto min-h-16 w-full whitespace-normal py-3"
              onClick={() => setStep({ name: "new", data: step.data })}
            >
              <PackagePlus aria-hidden />
              {t("lookup.noneOfThese")}
            </Button>
            <Button size="lg" className="w-full bg-action-camera" onClick={camera.open}>
              <Camera aria-hidden />
              {t("review.retake")}
            </Button>
          </div>
        )}

        {step.name === "new" && (
          <RecognitionReview
            key={step.data.recognitionId}
            data={step.data}
            previewUrl={previewUrl}
            mode="lookup"
            onRetake={camera.open}
            onSaved={(product) => {
              successFeedback();
              api.recordSearch(product.name, "image", product.id);
              router.replace(`/product/${product.id}?saved=1`);
            }}
            onUseExisting={async (productId) => openProduct(productId, step.data.result.name || "photo", "image")}
          />
        )}

        {step.name === "error" && (
          <div className="space-y-5">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={previewUrl} alt="" className="aspect-[4/3] w-full rounded-3xl border-2 border-border bg-white object-contain" />
            )}
            <p role="alert" className="flex gap-3 rounded-2xl bg-destructive/10 p-4 text-xl font-semibold text-destructive">
              {step.message === "lookup.notProduct" ? (
                <SearchX className="mt-0.5 size-8 shrink-0" aria-hidden />
              ) : (
                <TriangleAlert className="mt-0.5 size-8 shrink-0" aria-hidden />
              )}
              {t(step.message)}
            </p>
            <Button size="xl" className="w-full bg-action-camera" onClick={camera.open}>
              <Camera aria-hidden />
              {t("review.retake")}
            </Button>
            {step.settingsLink && (
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link href="/admin/ai-settings">
                  <Settings aria-hidden />
                  {t("detect.openSettings")}
                </Link>
              </Button>
            )}
          </div>
        )}
      </main>
    </>
  );
}
