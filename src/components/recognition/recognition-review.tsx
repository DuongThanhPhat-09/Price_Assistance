"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Camera, LoaderCircle, Lock, PackagePlus, Save, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/admin/product-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiRequestError } from "@/lib/api-client";
import { formatAmountPlain, formatMoney, parseAmount, toMinor } from "@/lib/money";
import type { ProductDTO, RecognitionMode, RecognitionResponse } from "@/lib/types";
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
  barcode: string;
  estimatedPrice: string;
  price: string;
  stockQuantity: string;
  shelfLocation: string;
  description: string;
}

type Errors = Partial<Record<keyof Values | "reviewed", string>>;

const PROVIDER_LABEL = { openai: "OpenAI", gemini: "Gemini" } as const;

function aiSuggestion(data: RecognitionResponse): number | null {
  return data.priceSuggestions.find((s) => s.source === "ai_estimate")?.amount ?? data.result.estimatedPrice;
}

function initialValues(data: RecognitionResponse, barcode?: string): Values {
  const r = data.result;
  const suggested = aiSuggestion(data);
  const estimate = suggested !== null ? formatAmountPlain(suggested) : "";
  return {
    name: r.name,
    brand: r.brand ?? "",
    model: r.model ?? "",
    variant: r.variant ?? "",
    category: r.category,
    barcode: barcode ?? r.barcode ?? "",
    estimatedPrice: estimate,
    price: estimate,
    stockQuantity: "",
    shelfLocation: "",
    description: r.description ?? "",
  };
}

/**
 * Review screen: everything the AI found, pre-filled and editable, with
 * possible duplicates on top. Low-confidence results need an explicit
 * "I have checked" before Save (the server enforces it too).
 *
 * `mode="lookup"` is the customer camera's "New Product Detected" screen:
 * picking a possible match opens that product instead of editing it.
 */
export function RecognitionReview({
  data,
  previewUrl,
  initialBarcode,
  mode = "create",
  onRetake,
  onSaved,
  onUseExisting,
}: {
  data: RecognitionResponse;
  previewUrl: string | null;
  initialBarcode?: string;
  mode?: RecognitionMode;
  onRetake: () => void;
  onSaved: (product: ProductDTO) => void;
  onUseExisting: (productId: number) => Promise<void>;
}) {
  const { t } = useI18n();
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const r = data.result;
  const lookup = mode === "lookup";

  const [values, setValues] = useState<Values>(() => initialValues(data, initialBarcode));
  const [errors, setErrors] = useState<Errors>({});
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);
  const [showMatches, setShowMatches] = useState(data.matches.length > 0);
  const [categories, setCategories] = useState<string[] | null>(null);
  // Saving needs the admin PIN when one is set; ask for it here so nothing typed is lost.
  const [pinPrompt, setPinPrompt] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const priceTouched = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => undefined);
  }, []);

  const set = (key: keyof Values) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setValues((v) => ({
      ...v,
      [key]: value,
      // Selling price follows the suggestion until the owner edits it.
      ...(key === "estimatedPrice" && !priceTouched.current ? { price: value } : {}),
    }));
    if (key === "price") priceTouched.current = true;
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const categorySuggestions = [...new Set([r.category, ...r.categoryAlternatives].filter(Boolean))].slice(0, 4);
  const isExisting = (c: string) => categories?.some((x) => x.toLowerCase() === c.toLowerCase()) ?? true;
  // Future sources (supplier, e-commerce…) are shown read-only under the AI suggestion.
  const otherPrices = data.priceSuggestions.filter((s) => s.source !== "ai_estimate");

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
    const estimate = values.estimatedPrice.trim() ? parseAmount(values.estimatedPrice) : null;
    if (values.estimatedPrice.trim() && estimate === null) errs.estimatedPrice = t("form.invalidNumber");
    const price = parseAmount(values.price);
    if (price === null) errs.price = values.price.trim() ? t("form.invalidNumber") : t("form.required");
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
        shelfLocation: values.shelfLocation,
        imageUrl: data.imageUrl,
        estimatedPrice: estimate === null ? null : toMinor(estimate),
        reviewed: reviewed || !data.lowConfidence,
      });
      onSaved(product);
    } catch (err) {
      const status = err instanceof ApiRequestError ? err.status : undefined;
      const code = err instanceof ApiRequestError ? err.code : undefined;
      const msg = (err as Error).message || t("common.error");
      if (status === 401) {
        setPinPrompt(true);
        requestAnimationFrame(() => focus("pin"));
        return;
      }
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

  /** Unlock with the admin PIN, then save what was typed. */
  const unlockAndSave = async () => {
    if (!pin.trim()) return;
    setUnlocking(true);
    setPinError("");
    try {
      await api.login(pin);
      setPinPrompt(false);
      setPin("");
      formRef.current?.requestSubmit();
    } catch (err) {
      setPinError(err instanceof ApiRequestError && err.status === 401 ? t("login.wrong") : (err as Error).message);
      setPin("");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
      {lookup && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-action-detect bg-violet-50 p-4">
          <PackagePlus className="mt-0.5 size-8 shrink-0 text-action-detect" aria-hidden />
          <div>
            <h2 className="text-2xl font-extrabold leading-tight">{t("lookup.newTitle")}</h2>
            <p className="mt-1 text-lg leading-snug">{t("lookup.newHint")}</p>
          </div>
        </div>
      )}

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img
          src={previewUrl}
          alt={r.name}
          className="aspect-[4/3] w-full rounded-3xl border-2 border-border bg-white object-contain"
        />
      )}

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
          title={lookup ? t("lookup.maybeTitle") : undefined}
          hint={lookup ? t("lookup.maybeHint") : undefined}
          useLabel={lookup ? t("lookup.maybeUse") : undefined}
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

      {/* Prices: the AI suggestion is clearly a guess; the shop's price is what counts. */}
      <section className="space-y-5 rounded-3xl border-2 border-border bg-card p-4">
        <Field id={id("estimatedPrice")} label={t("review.estimatedPrice")} error={errors.estimatedPrice}>
          <div className="relative">
            <Sparkles
              className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-action-detect"
              aria-hidden
            />
            <Input
              id={id("estimatedPrice")}
              inputMode="decimal"
              placeholder={t("review.estimatedPriceNone")}
              value={values.estimatedPrice}
              onChange={set("estimatedPrice")}
              aria-invalid={!!errors.estimatedPrice}
              aria-describedby={id("estimate-note")}
              className="border-dashed pl-13 text-2xl"
            />
          </div>
        </Field>
        <p
          id={id("estimate-note")}
          className="-mt-2 flex gap-2 rounded-xl bg-violet-50 p-3 text-base font-medium leading-snug text-foreground"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-action-detect" aria-hidden />
          {t("review.estimatedPriceHint")}
        </p>

        {otherPrices.length > 0 && (
          <ul className="space-y-1 text-base">
            {otherPrices.map((s, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {t(`price.source.${s.source}`)}
                  {s.sourceName ? ` · ${s.sourceName}` : ""}
                </span>
                <span className="font-bold">{formatMoney(s.amount)}</span>
              </li>
            ))}
          </ul>
        )}

        <Field id={id("price")} label={t("review.sellingPrice")} hint={t("review.sellingPriceHint")} error={errors.price} required>
          <Input
            id={id("price")}
            inputMode="decimal"
            value={values.price}
            onChange={set("price")}
            aria-invalid={!!errors.price}
            className="h-18 border-[3px] border-price text-3xl font-black text-price"
          />
        </Field>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
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
        <Field id={id("shelfLocation")} label={t("form.location")} hint={t("form.locationHint")}>
          <Input id={id("shelfLocation")} value={values.shelfLocation} onChange={set("shelfLocation")} className="text-2xl" />
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

      <ConfidenceMeter
        confidence={r.confidence}
        footer={t("review.byProvider", {
          provider: PROVIDER_LABEL[data.provider],
          model: data.model,
          seconds: (data.durationMs / 1000).toFixed(1),
        })}
      />

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

      {pinPrompt && (
        <section aria-labelledby={id("pin-title")} className="space-y-3 rounded-3xl border-2 border-primary bg-accent p-4">
          <h2 id={id("pin-title")} className="flex items-center gap-2 text-xl font-extrabold">
            <Lock className="size-6 text-primary" aria-hidden />
            {t("review.pinTitle")}
          </h2>
          <p className="text-base leading-snug">{t("review.pinHint")}</p>
          <Input
            id={id("pin")}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void unlockAndSave();
              }
            }}
            aria-label={t("login.title")}
            aria-invalid={!!pinError}
            className="h-16 text-center text-3xl tracking-[0.4em]"
          />
          {pinError && (
            <p role="alert" className="text-base font-semibold text-destructive">
              {pinError}
            </p>
          )}
          <Button type="button" size="lg" className="w-full" disabled={!pin || unlocking} onClick={() => void unlockAndSave()}>
            {unlocking ? <LoaderCircle className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
            {t("review.pinUnlock")}
          </Button>
        </section>
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
            disabled={saving || linking !== null || unlocking}
          >
            {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {t("review.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
