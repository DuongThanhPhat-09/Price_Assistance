"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Camera, LoaderCircle, Save, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiRequestError } from "@/lib/api-client";
import { formatAmountPlain, parseAmount, toMinor } from "@/lib/money";
import type { ProductDTO, RecognitionResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";
import { ConfidenceMeter } from "./confidence-meter";
import { PossibleMatches } from "./possible-matches";

interface Values {
  name: string;
  brand: string;
  model: string;
  variant: string;
  category: string;
  estimatedPrice: string;
  price: string;
  stockQuantity: string;
  barcode: string;
  description: string;
}

type Errors = Partial<Record<keyof Values | "reviewed", string>>;

const PROVIDER_LABEL = { openai: "OpenAI", gemini: "Gemini" } as const;

function initialValues(data: RecognitionResponse, barcode?: string): Values {
  const r = data.result;
  const estimate = r.estimatedPrice !== null ? formatAmountPlain(r.estimatedPrice) : "";
  return {
    name: r.name,
    brand: r.brand ?? "",
    model: r.model ?? "",
    variant: r.variant ?? "",
    category: r.category,
    estimatedPrice: estimate,
    price: estimate,
    stockQuantity: "",
    barcode: barcode ?? r.barcode ?? "",
    description: r.description ?? "",
  };
}

/**
 * Review screen: everything the AI found, pre-filled and editable, with
 * possible duplicates on top. Low-confidence results need an explicit
 * "I have checked" before Save (the server enforces it too).
 */
export function RecognitionReview({
  data,
  previewUrl,
  initialBarcode,
  onRetake,
  onSaved,
  onUseExisting,
}: {
  data: RecognitionResponse;
  previewUrl: string | null;
  initialBarcode?: string;
  onRetake: () => void;
  onSaved: (product: ProductDTO) => void;
  onUseExisting: (productId: number) => Promise<void>;
}) {
  const { t } = useI18n();
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const r = data.result;

  const [values, setValues] = useState<Values>(() => initialValues(data, initialBarcode));
  const [errors, setErrors] = useState<Errors>({});
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);
  const [showMatches, setShowMatches] = useState(data.matches.length > 0);
  const [categories, setCategories] = useState<string[] | null>(null);
  const priceTouched = useRef(false);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => undefined);
  }, []);

  const set = (key: keyof Values) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setValues((v) => ({
      ...v,
      [key]: value,
      // Selling price follows the estimate until the owner edits it.
      ...(key === "estimatedPrice" && !priceTouched.current ? { price: value } : {}),
    }));
    if (key === "price") priceTouched.current = true;
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const categorySuggestions = [...new Set([r.category, ...r.categoryAlternatives].filter(Boolean))].slice(0, 4);
  const isExisting = (c: string) => categories?.some((x) => x.toLowerCase() === c.toLowerCase()) ?? true;

  const pickExisting = async (productId: number) => {
    setLinking(productId);
    try {
      await onUseExisting(productId);
    } finally {
      setLinking(null);
    }
  };

  const focus = (key: string) => {
    const el = document.getElementById(id(key));
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (!values.name.trim()) errs.name = t("form.required");
    if (!values.category.trim()) errs.category = t("form.required");
    const price = parseAmount(values.price);
    if (price === null) errs.price = values.price.trim() ? t("form.invalidNumber") : t("form.required");
    const estimate = values.estimatedPrice.trim() ? parseAmount(values.estimatedPrice) : null;
    if (values.estimatedPrice.trim() && estimate === null) errs.estimatedPrice = t("form.invalidNumber");
    const stock = values.stockQuantity.trim() ? Number(values.stockQuantity.replace(/[^\d-]/g, "")) : 0;
    if (!Number.isInteger(stock) || stock < 0) errs.stockQuantity = t("form.invalidNumber");
    if (data.lowConfidence && !reviewed) errs.reviewed = t("review.confirmRequired");

    if (Object.keys(errs).length) {
      setErrors(errs);
      focus(Object.keys(errs)[0]);
      return;
    }

    setSaving(true);
    try {
      const product = await api.saveRecognized(data.recognitionId, {
        name: values.name,
        brand: values.brand,
        model: values.model,
        variant: values.variant,
        category: values.category,
        price: toMinor(price!),
        costPrice: 0,
        stockQuantity: stock,
        barcode: values.barcode,
        description: values.description,
        shelfLocation: null,
        imageUrl: data.imageUrl,
        estimatedPrice: estimate === null ? null : toMinor(estimate),
        reviewed: reviewed || !data.lowConfidence,
      });
      onSaved(product);
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : undefined;
      const msg = (err as Error).message || t("common.error");
      if (code === "duplicate_barcode") {
        setErrors({ barcode: msg });
        focus("barcode");
      } else if (code === "needs_review") {
        setErrors({ reviewed: t("review.confirmRequired") });
        focus("reviewed");
      } else if (code === "already_saved") {
        toast.info(t("review.alreadySaved"));
        onRetake();
        return;
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img
          src={previewUrl}
          alt={r.name}
          className="aspect-[4/3] w-full rounded-3xl border-2 border-border bg-white object-contain"
        />
      )}

      <ConfidenceMeter
        confidence={r.confidence}
        footer={t("review.byProvider", {
          provider: PROVIDER_LABEL[data.provider],
          seconds: (data.durationMs / 1000).toFixed(1),
        })}
      />

      {data.lowConfidence && (
        <div role="alert" className="flex gap-3 rounded-2xl border-2 border-warning bg-amber-50 p-4">
          <TriangleAlert className="mt-0.5 size-7 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="text-lg font-bold leading-snug">{t("review.lowConfidence")}</p>
            <p className="text-base">{r.isProduct ? t("review.lowConfidenceHint") : t("review.notProduct")}</p>
          </div>
        </div>
      )}

      {showMatches && (
        <PossibleMatches
          matches={data.matches}
          busyId={linking}
          onUse={(pid) => void pickExisting(pid)}
          onDismiss={() => {
            setShowMatches(false);
            focus("name");
          }}
        />
      )}

      <h2 className="flex items-center gap-2 text-2xl font-extrabold">
        <Sparkles className="size-7 text-action-detect" aria-hidden />
        {t("review.title")}
      </h2>

      <Field id={id("name")} label={t("form.name")} error={errors.name} required>
        <Input id={id("name")} value={values.name} onChange={set("name")} aria-invalid={!!errors.name} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id={id("brand")} label={t("form.brand")}>
          <Input id={id("brand")} value={values.brand} onChange={set("brand")} />
        </Field>
        <Field id={id("model")} label={t("form.model")}>
          <Input id={id("model")} value={values.model} onChange={set("model")} className="font-mono tracking-wide" />
        </Field>
      </div>

      <Field id={id("variant")} label={t("form.variant")} hint={t("form.variantHint")}>
        <Input id={id("variant")} value={values.variant} onChange={set("variant")} />
      </Field>

      <Field id={id("category")} label={t("form.category")} error={errors.category} required>
        <Input
          id={id("category")}
          list={id("category-list")}
          value={values.category}
          onChange={set("category")}
          aria-invalid={!!errors.category}
        />
        <datalist id={id("category-list")}>
          {(categories ?? []).map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {categorySuggestions.length > 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {categorySuggestions.map((c) => {
              const active = values.category.trim().toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set("category")({ target: { value: c } })}
                  className={cn(
                    "min-h-12 rounded-full border-2 px-4 text-base font-semibold",
                    active ? "border-primary bg-accent" : "border-input bg-card",
                  )}
                >
                  {c}
                  {!isExisting(c) && (
                    <span className="ml-2 text-sm font-bold uppercase text-action-detect">{t("review.newCategory")}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id={id("estimatedPrice")}
          label={t("review.estimatedPrice")}
          hint={t("review.estimatedPriceHint")}
          error={errors.estimatedPrice}
        >
          <div className="relative">
            <Sparkles
              className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-action-detect"
              aria-hidden
            />
            <Input
              id={id("estimatedPrice")}
              inputMode="decimal"
              value={values.estimatedPrice}
              onChange={set("estimatedPrice")}
              aria-invalid={!!errors.estimatedPrice}
              className="border-dashed pl-13 text-2xl"
            />
          </div>
        </Field>
        <Field id={id("price")} label={t("review.sellingPrice")} error={errors.price} required>
          <Input
            id={id("price")}
            inputMode="decimal"
            value={values.price}
            onChange={set("price")}
            aria-invalid={!!errors.price}
            className="text-2xl font-bold"
          />
        </Field>
        <Field id={id("stockQuantity")} label={t("form.stock")} error={errors.stockQuantity}>
          <Input
            id={id("stockQuantity")}
            inputMode="numeric"
            placeholder="0"
            value={values.stockQuantity}
            onChange={set("stockQuantity")}
            aria-invalid={!!errors.stockQuantity}
            className="text-2xl"
          />
        </Field>
        <Field id={id("barcode")} label={t("form.barcode")} hint={t("form.barcodeHint")} error={errors.barcode}>
          <Input
            id={id("barcode")}
            inputMode="numeric"
            value={values.barcode}
            onChange={set("barcode")}
            aria-invalid={!!errors.barcode}
            className="font-mono tracking-wider"
          />
        </Field>
      </div>

      <Field id={id("description")} label={t("review.description")}>
        <Textarea id={id("description")} value={values.description} onChange={set("description")} />
      </Field>

      {r.keywords.length > 0 && (
        <div className="space-y-2">
          <p className="text-lg font-semibold">{t("review.keywords")}</p>
          <ul className="flex flex-wrap gap-2">
            {r.keywords.map((k) => (
              <li key={k} className="rounded-full bg-secondary px-4 py-1.5 text-base font-semibold">
                {k}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.visibleText.length > 0 && (
        <details className="rounded-2xl border-2 border-border bg-card p-4">
          <summary className="min-h-8 cursor-pointer text-lg font-semibold">{t("review.visibleText")}</summary>
          <p className="mt-2 whitespace-pre-line font-mono text-base">{r.visibleText.join("\n")}</p>
        </details>
      )}

      {data.lowConfidence && (
        <div className="space-y-2">
          <label
            htmlFor={id("reviewed")}
            className={cn(
              "flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 bg-card p-4 text-lg font-bold",
              errors.reviewed ? "border-destructive" : "border-warning",
            )}
          >
            <input
              id={id("reviewed")}
              type="checkbox"
              checked={reviewed}
              onChange={(e) => {
                setReviewed(e.target.checked);
                setErrors((er) => ({ ...er, reviewed: undefined }));
              }}
              className="size-8 shrink-0 accent-[var(--primary)]"
            />
            {t("review.confirmChecked")}
          </label>
          {errors.reviewed && <p className="text-base font-semibold text-destructive">{errors.reviewed}</p>}
        </div>
      )}

      {/* Spacer so the last field is never hidden behind the action bar. */}
      <div aria-hidden className="h-20 pb-[env(safe-area-inset-bottom)]" />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-3 px-4 py-3">
          {/* Labels may wrap on narrow phones rather than push Save off-screen. */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-auto min-h-16 max-w-[45%] shrink-0 whitespace-normal px-3 py-2 text-lg leading-tight"
            onClick={onRetake}
            disabled={saving}
          >
            <Camera aria-hidden />
            {t("review.retake")}
          </Button>
          <Button
            type="submit"
            size="lg"
            className="h-auto min-h-16 min-w-0 flex-1 whitespace-normal px-3 py-2 leading-tight"
            disabled={saving || linking !== null}
          >
            {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {t("review.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
