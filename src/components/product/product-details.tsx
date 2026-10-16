"use client";

import Link from "next/link";
import { Barcode, Boxes, Clock, MapPin, Pencil, Search, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { QuickActionBar, QuickActionBarSpacer } from "@/components/layout/quick-action-bar";
import { Button } from "@/components/ui/button";
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

export function ProductDetails({ product, query }: { product: ProductDTO; query?: string }) {
  const { t, formatDate } = useI18n();
  const showCost = useSettingsStore((s) => s.showCostPrice);
  const level = stockLevel(product.stockQuantity);
  const profit = product.price - product.costPrice;
  const margin = product.price > 0 ? Math.round((profit / product.price) * 100) : 0;

  return (
    <>
      <PageHeader title={t("product.title")} />
      <main className="mx-auto max-w-3xl px-4 pt-4">
        <article className="overflow-hidden rounded-3xl border-2 border-border bg-card shadow-sm">
          <div className="md:flex">
            <div className="px-5 pt-5 md:w-80 md:shrink-0 md:pb-5 md:pr-0">
              <ProductImage
                src={product.imageUrl}
                alt={product.name}
                category={product.category}
                className="aspect-[16/10] w-full rounded-2xl md:aspect-square"
                iconClassName="size-2/5"
              />
            </div>
            <div className="p-5 md:min-w-0 md:flex-1">
              <h2 className="text-[1.75rem] font-extrabold leading-tight sm:text-3xl">{product.name}</h2>
              <div className="mt-3">
                <StockBadge quantity={product.stockQuantity} />
              </div>

              {/* The answer to "how much is it?" — biggest thing on screen. */}
              <div className="mt-5 rounded-2xl bg-red-50 p-4 ring-2 ring-red-200">
                <p className="text-lg font-semibold text-muted-foreground">{t("product.price")}</p>
                <p className="text-5xl font-black tracking-tight text-price sm:text-6xl">{formatMoney(product.price)}</p>
              </div>

              {showCost && (
                <div className="mt-3 grid grid-cols-2 gap-3">
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
            </div>
          </div>

          <div className="divide-y-2 divide-border border-t-2 border-border px-5">
            <InfoRow icon={<Boxes aria-hidden />} label={t("product.stock")}>
              <span
                className={cn(
                  "text-3xl font-black",
                  level === "out" ? "text-destructive" : level === "low" ? "text-warning" : "text-foreground",
                )}
              >
                {product.stockQuantity}
              </span>
            </InfoRow>
            <InfoRow icon={<MapPin aria-hidden />} label={t("product.location")}>
              <span className="text-3xl font-black">{product.shelfLocation || t("product.noLocation")}</span>
            </InfoRow>
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
          </div>

          {product.description && (
            <div className="border-t-2 border-border p-5">
              <p className="text-base font-medium text-muted-foreground">{t("product.description")}</p>
              <p className="mt-1 whitespace-pre-line text-lg">{product.description}</p>
            </div>
          )}
        </article>

        {query && (
          <Button asChild size="lg" variant="outline" className="mt-4 h-auto w-full whitespace-normal py-4 text-left">
            <Link href={`/search?q=${encodeURIComponent(query)}`}>
              <Search aria-hidden />
              {t("product.notRight")}
            </Link>
          </Button>
        )}

        <div className="mt-6 flex justify-center">
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link href={`/admin/products/${product.id}/edit`}>
              <Pencil aria-hidden />
              {t("product.edit")}
            </Link>
          </Button>
        </div>

        <QuickActionBarSpacer />
      </main>
      <QuickActionBar />
    </>
  );
}
