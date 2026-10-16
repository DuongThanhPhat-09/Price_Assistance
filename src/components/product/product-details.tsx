"use client";

import Link from "next/link";
import { Barcode, Boxes, Camera, CircleCheck, Clock, Factory, Hash, House, Layers, MapPin, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { CameraLookupButton } from "@/components/camera/camera-button";
import { PageHeader } from "@/components/layout/page-header";
import { formatMoney } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";
import { useSettingsStore } from "@/store/settings-store";
import { ProductImage } from "./product-image";
import { StockBadge, stockLevel } from "./stock-badge";

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary [&_svg]:size-7">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-muted-foreground">{label}</p>
        <div className="text-xl font-bold leading-snug">{children}</div>
      </div>
    </div>
  );
}

/** Big tile for the two numbers people ask right after the price. */
function Tile({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border-2 border-border bg-card p-4">
      <p className="flex items-center gap-2 text-base font-semibold text-muted-foreground [&_svg]:size-6">
        {icon}
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * The answer screen of customer mode: price first and biggest, then
 * stock and shelf. Read-only on purpose; editing lives in Manage Products.
 */
export function ProductDetails({ product, justSaved = false }: { product: ProductDTO; justSaved?: boolean }) {
  const { t, formatDate } = useI18n();
  const showCost = useSettingsStore((s) => s.showCostPrice);
  const level = stockLevel(product.stockQuantity);
  const profit = product.price - product.costPrice;
  const margin = product.price > 0 ? Math.round((profit / product.price) * 100) : 0;

  return (
    <>
      <PageHeader title={t("product.title")} narrow />
      <main className="mx-auto max-w-xl px-4 pt-4">
        {justSaved && (
          <p role="status" className="mb-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-lg font-bold ring-2 ring-emerald-200">
            <CircleCheck className="size-7 shrink-0 text-success" aria-hidden />
            {t("product.justSaved")}
          </p>
        )}

        <article className="space-y-4">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            category={product.category}
            className="aspect-[4/3] w-full rounded-3xl border-2 border-border"
            iconClassName="size-2/5"
          />

          <h2 className="text-[1.75rem] font-extrabold leading-tight sm:text-3xl">{product.name}</h2>

          {/* The answer to "how much is it?" — the biggest thing on screen. */}
          <div className="rounded-3xl bg-red-50 p-5 ring-[3px] ring-red-200">
            <p className="text-xl font-bold text-muted-foreground">{t("product.price")}</p>
            <p className="break-words text-[3.5rem] font-black leading-none tracking-tight text-price sm:text-7xl">
              {formatMoney(product.price)}
            </p>
          </div>

          {showCost && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-secondary p-4">
                <p className="text-base font-medium text-muted-foreground">{t("product.cost")}</p>
                <p className="text-2xl font-extrabold">{formatMoney(product.costPrice)}</p>
              </div>
              <div className="rounded-2xl bg-secondary p-4">
                <p className="text-base font-medium text-muted-foreground">{t("product.profit")}</p>
                <p className={cn("text-2xl font-extrabold", profit < 0 ? "text-destructive" : "text-success")}>
                  {formatMoney(profit)} <span className="text-lg font-bold">({margin}%)</span>
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Tile icon={<Boxes aria-hidden />} label={t("product.stock")}>
              <p
                className={cn(
                  "text-4xl font-black",
                  level === "out" ? "text-destructive" : level === "low" ? "text-warning" : "text-foreground",
                )}
              >
                {product.stockQuantity}
              </p>
              <StockBadge quantity={product.stockQuantity} className="mt-2 whitespace-normal px-3 text-base" />
            </Tile>
            <Tile icon={<MapPin aria-hidden />} label={t("product.location")}>
              <p className="break-words text-4xl font-black">{product.shelfLocation || t("product.noLocation")}</p>
            </Tile>
          </div>

          <div className="divide-y-2 divide-border rounded-3xl border-2 border-border bg-card px-5">
            <InfoRow icon={<Tag aria-hidden />} label={t("product.category")}>
              {product.category}
            </InfoRow>
            {product.barcode && (
              <InfoRow icon={<Barcode aria-hidden />} label={t("product.barcode")}>
                <span className="font-mono tracking-wider">{product.barcode}</span>
              </InfoRow>
            )}
            <InfoRow icon={<Clock aria-hidden />} label={t("product.updated")}>
              <span suppressHydrationWarning>{formatDate(product.updatedAt)}</span>
            </InfoRow>
            {product.brand && (
              <InfoRow icon={<Factory aria-hidden />} label={t("product.brand")}>
                {product.brand}
              </InfoRow>
            )}
            {product.model && (
              <InfoRow icon={<Hash aria-hidden />} label={t("product.model")}>
                <span className="font-mono tracking-wide">{product.model}</span>
              </InfoRow>
            )}
            {product.variant && (
              <InfoRow icon={<Layers aria-hidden />} label={t("product.variant")}>
                {product.variant}
              </InfoRow>
            )}
          </div>

          {product.description && (
            <div className="rounded-3xl border-2 border-border bg-card p-5">
              <p className="text-base font-medium text-muted-foreground">{t("product.description")}</p>
              <p className="mt-1 whitespace-pre-line text-lg">{product.description}</p>
            </div>
          )}
        </article>

        <div aria-hidden className="h-32 pb-[env(safe-area-inset-bottom)]" />
      </main>

      {/* Next product is always one tap away. */}
      <nav
        aria-label={t("product.next")}
        className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto flex max-w-xl gap-3 px-4 py-3">
          <Link
            href="/"
            aria-label={t("common.home")}
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-border bg-card text-sm font-bold active:bg-accent"
          >
            <House className="size-8" aria-hidden />
            {t("common.home")}
          </Link>
          <CameraLookupButton
            replace
            className="flex h-20 min-w-0 flex-1 items-center justify-center gap-3 rounded-2xl bg-action-camera px-3 text-2xl font-extrabold leading-tight text-white shadow-md active:scale-[0.98]"
          >
            <Camera className="size-9 shrink-0" aria-hidden />
            <span className="min-w-0">{t("product.photoNext")}</span>
          </CameraLookupButton>
        </div>
      </nav>
    </>
  );
}
