"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Info, LoaderCircle, Save, ScanBarcode, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { ProductImage } from "@/components/product/product-image";
import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { cleanBarcode } from "@/lib/barcode";
import { successFeedback } from "@/lib/feedback";
import { formatAmountPlain, formatMoney, parseAmount, toMinor } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";
import { productInputSchema } from "@/lib/validation";
import { useI18n } from "@/i18n/i18n-provider";
import { DeleteProductButton } from "./delete-product-button";
import { hasInAppHistory } from "@/components/layout/navigation-tracker";

interface FormValues {
  name: string;
  barcode: string;
  category: string;
  price: string;
  costPrice: string;
  stockQuantity: string;
  shelfLocation: string;
  imageUrl: string;
  description: string;
  brand: string;
  model: string;
  variant: string;
}

type FieldErrors = Partial<Record<keyof FormValues, string>>;

function toValues(p?: ProductDTO, barcode?: string): FormValues {
  return {
    name: p?.name ?? "",
    barcode: p?.barcode ?? barcode ?? "",
    category: p?.category ?? "",
    price: p ? formatAmountPlain(p.price) : "",
    costPrice: p ? formatAmountPlain(p.costPrice) : "",
    stockQuantity: p ? String(p.stockQuantity) : "",
    shelfLocation: p?.shelfLocation ?? "",
    imageUrl: p?.imageUrl ?? "",
    description: p?.description ?? "",
    brand: p?.brand ?? "",
    model: p?.model ?? "",
    variant: p?.variant ?? "",
  };
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-base font-semibold text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-base text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Why the form was opened: from scan-to-add, or a photo matched an existing product. */
export type FormNotice = "scan-new" | "scan-existing" | "recognize-existing";

export function ProductForm({
  product,
  initialBarcode,
  notice,
}: {
  product?: ProductDTO;
  initialBarcode?: string;
  notice?: FormNotice;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const uid = useId();
  const [values, setValues] = useState<FormValues>(() => toValues(product, initialBarcode));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [taken, setTaken] = useState<{ id: number; name: string } | null>(null);
  const scanHandled = useRef(false);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => undefined);
  }, []);

  const set = (key: keyof FormValues) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
    if (key === "barcode") setTaken(null);
  };

  /** Warn right away if the barcode already belongs to another product. */
  const checkBarcode = async (raw: string) => {
    const code = cleanBarcode(raw);
    if (!code) return;
    try {
      const existing = await api.byBarcode(code);
      if (existing && existing.id !== product?.id) {
        setTaken({ id: existing.id, name: existing.name });
        setErrors((er) => ({ ...er, barcode: t("form.barcodeTaken", { name: existing.name }) }));
      }
    } catch {
      /* the server re-checks on save */
    }
  };

  const openScanner = () => {
    scanHandled.current = false;
    setScanning(true);
  };

  const onScanned = (raw: string) => {
    if (scanHandled.current) return;
    scanHandled.current = true;
    const code = cleanBarcode(raw);
    successFeedback();
    setScanning(false);
    setValues((v) => ({ ...v, barcode: code }));
    setErrors((er) => ({ ...er, barcode: undefined }));
    setTaken(null);
    void checkBarcode(code);
  };

  const id = (k: string) => `${uid}-${k}`;

  const done = () => {
    if (hasInAppHistory()) router.back();
    else router.push("/admin");
    router.refresh();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: FieldErrors = {};
    if (taken) errs.barcode = t("form.barcodeTaken", { name: taken.name });
    if (!values.name.trim()) errs.name = t("form.required");
    if (!values.category.trim()) errs.category = t("form.required");
    const price = parseAmount(values.price);
    if (price === null) errs.price = values.price.trim() ? t("form.invalidNumber") : t("form.required");
    const cost = values.costPrice.trim() ? parseAmount(values.costPrice) : 0;
    if (cost === null) errs.costPrice = t("form.invalidNumber");
    const stock = values.stockQuantity.trim() ? Number(values.stockQuantity.replace(/[^\d-]/g, "")) : 0;
    if (!Number.isInteger(stock) || stock < 0) errs.stockQuantity = t("form.invalidNumber");

    if (Object.keys(errs).length) {
      setErrors(errs);
      document.getElementById(id(Object.keys(errs)[0]))?.focus();
      return;
    }

    const parsed = productInputSchema.safeParse({
      name: values.name,
      barcode: values.barcode,
      category: values.category,
      price: toMinor(price!),
      costPrice: toMinor(cost!),
      stockQuantity: stock,
      shelfLocation: values.shelfLocation,
      imageUrl: values.imageUrl,
      description: values.description,
      brand: values.brand,
      model: values.model,
      variant: values.variant,
    });
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] as keyof FormValues] = issue.message;
      setErrors(fe);
      return;
    }

    setSaving(true);
    try {
      if (product) await api.update(product.id, parsed.data);
      else await api.create(parsed.data);
      toast.success(t("admin.saved"));
      done();
    } catch (err) {
      const msg = (err as Error).message || t("common.error");
      if (/barcode/i.test(msg)) setErrors({ barcode: msg });
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {notice && (
        <div role="status" className="space-y-3 rounded-2xl bg-accent p-4">
          <p className="flex gap-3 text-lg font-medium leading-snug">
            <Info className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
            {notice === "scan-new"
              ? t("form.scanNewNotice", { code: values.barcode })
              : notice === "scan-existing"
                ? t("form.scanExistingNotice")
                : t("form.recognizeExistingNotice")}
          </p>
          {notice === "scan-new" && (
            <Button
              type="button"
              className="h-auto min-h-14 w-full whitespace-normal bg-action-detect py-3 text-white hover:bg-action-detect/90"
              // replace: after saving, Back returns to the scanner, not to this empty form
              onClick={() => router.replace(`/admin/detect?barcode=${encodeURIComponent(values.barcode)}&from=scan`)}
            >
              <Camera aria-hidden />
              {t("form.fillFromPhoto")}
            </Button>
          )}
        </div>
      )}

      <Field id={id("name")} label={t("form.name")} error={errors.name} required>
        <Input id={id("name")} value={values.name} onChange={set("name")} aria-invalid={!!errors.name} autoFocus={!product} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id={id("price")} label={t("form.price")} error={errors.price} required>
          <Input
            id={id("price")}
            inputMode="decimal"
            value={values.price}
            onChange={set("price")}
            aria-invalid={!!errors.price}
            className="text-2xl font-bold"
          />
          {product?.aiEstimatedPrice != null && (
            <p className="flex items-start gap-2 text-base text-muted-foreground">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-action-detect" aria-hidden />
              {t("form.aiEstimate", { price: formatMoney(product.aiEstimatedPrice) })}
            </p>
          )}
        </Field>
        <Field id={id("costPrice")} label={t("form.costPrice")} error={errors.costPrice}>
          <Input
            id={id("costPrice")}
            inputMode="decimal"
            value={values.costPrice}
            onChange={set("costPrice")}
            aria-invalid={!!errors.costPrice}
            className="text-2xl"
          />
        </Field>
        <Field id={id("stockQuantity")} label={t("form.stock")} error={errors.stockQuantity}>
          <Input
            id={id("stockQuantity")}
            inputMode="numeric"
            value={values.stockQuantity}
            onChange={set("stockQuantity")}
            aria-invalid={!!errors.stockQuantity}
            className="text-2xl"
          />
        </Field>
        <Field id={id("shelfLocation")} label={t("form.location")} hint={t("form.locationHint")} error={errors.shelfLocation}>
          <Input id={id("shelfLocation")} value={values.shelfLocation} onChange={set("shelfLocation")} className="text-2xl uppercase" />
        </Field>
      </div>

      <Field id={id("category")} label={t("form.category")} error={errors.category} required>
        <Input
          id={id("category")}
          list={id("category-list")}
          value={values.category}
          onChange={set("category")}
          aria-invalid={!!errors.category}
        />
        <datalist id={id("category-list")}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id={id("brand")} label={t("form.brand")} error={errors.brand}>
          <Input id={id("brand")} value={values.brand} onChange={set("brand")} />
        </Field>
        <Field id={id("model")} label={t("form.model")} error={errors.model}>
          <Input id={id("model")} value={values.model} onChange={set("model")} className="font-mono tracking-wide" />
        </Field>
      </div>

      <Field id={id("variant")} label={t("form.variant")} hint={t("form.variantHint")} error={errors.variant}>
        <Input id={id("variant")} value={values.variant} onChange={set("variant")} />
      </Field>

      <div className="space-y-3">
        <Field
          id={id("barcode")}
          label={t("form.barcode")}
          hint={t("form.barcodeHint")}
          error={
            taken ? (
              <>
                {errors.barcode}{" "}
                <Link href={`/admin/products/${taken.id}/edit`} className="text-primary underline">
                  {t("form.openExisting")}
                </Link>
              </>
            ) : (
              errors.barcode
            )
          }
        >
          <Input
            id={id("barcode")}
            inputMode="numeric"
            value={values.barcode}
            onChange={set("barcode")}
            onBlur={(e) => void checkBarcode(e.target.value)}
            aria-invalid={!!errors.barcode}
            className="font-mono tracking-wider"
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          onClick={scanning ? () => setScanning(false) : openScanner}
          className="w-full"
        >
          {scanning ? <X aria-hidden /> : <ScanBarcode aria-hidden />}
          {scanning ? t("form.closeScanner") : t("form.scanBarcode")}
        </Button>
        {scanning && <BarcodeScanner onDetected={onScanned} />}
      </div>

      <Field id={id("imageUrl")} label={t("form.imageUrl")} hint={t("form.imageHint")} error={errors.imageUrl}>
        <div className="flex items-center gap-3">
          <ProductImage
            src={values.imageUrl || null}
            alt=""
            category={values.category || "-"}
            className="size-16 shrink-0 rounded-xl border-2 border-border"
          />
          <Input id={id("imageUrl")} type="url" value={values.imageUrl} onChange={set("imageUrl")} placeholder="https://…" />
        </div>
      </Field>

      <Field id={id("description")} label={t("form.description")} error={errors.description}>
        <Textarea id={id("description")} value={values.description} onChange={set("description")} />
      </Field>

      {/* Spacer so the last field is never hidden behind the save bar. */}
      <div aria-hidden className="h-20 pb-[env(safe-area-inset-bottom)]" />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3 px-4 py-3">
          {product && <DeleteProductButton id={product.id} name={product.name} onDeleted={() => router.push("/admin")} />}
          <Button type="submit" size="lg" className="flex-1" disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {t("common.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
