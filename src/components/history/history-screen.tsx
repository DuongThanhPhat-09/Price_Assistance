"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Mic, ScanBarcode, Search, type LucideIcon } from "lucide-react";
import { CameraLookupButton } from "@/components/camera/camera-button";
import { PageHeader } from "@/components/layout/page-header";
import { ProductImage } from "@/components/product/product-image";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { RecentSearchDTO, SearchType } from "@/lib/types";
import { useI18n } from "@/i18n/i18n-provider";

const HISTORY_LIMIT = 30;

const typeIcon: Record<SearchType, LucideIcon> = {
  image: Camera,
  barcode: ScanBarcode,
  voice: Mic,
  text: Search,
};

type CheckedProduct = RecentSearchDTO & { product: NonNullable<RecentSearchDTO["product"]> };

/** "History": the products checked lately, newest first, one tap to reopen. */
export function HistoryScreen() {
  const { t, formatRelative } = useI18n();
  const [items, setItems] = useState<CheckedProduct[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      // Only lookups that ended on a product: there is nothing to reopen otherwise.
      .recent(HISTORY_LIMIT, { productsOnly: true })
      .then((r) => alive && setItems(r.filter((x): x is CheckedProduct => x.product !== null)))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <PageHeader title={t("history.title")} backHref="/" narrow />
      <main className="mx-auto max-w-xl px-4 pt-4">
        {items === null ? (
          <div className="space-y-3" aria-busy="true" aria-label={t("common.loading")}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-xl text-muted-foreground">
            {t("history.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const TypeIcon = typeIcon[item.searchType] ?? Search;
              return (
                <li key={item.id}>
                  <Link
                    href={`/product/${item.product.id}`}
                    className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card p-3 text-left shadow-sm hover:border-primary active:bg-accent"
                  >
                    <ProductImage
                      src={item.product.imageUrl}
                      alt=""
                      category={item.product.category}
                      className="size-20 shrink-0 rounded-xl"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-xl font-bold leading-snug">{item.product.name}</span>
                      <span className="block text-2xl font-black text-price">{formatMoney(item.product.price)}</span>
                      <span className="inline-flex items-center gap-1 text-base text-muted-foreground" suppressHydrationWarning>
                        <TypeIcon className="size-4" aria-hidden />
                        {formatRelative(item.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div aria-hidden className="h-32 pb-[env(safe-area-inset-bottom)]" />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-3">
          <CameraLookupButton className="flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-action-camera px-3 text-2xl font-extrabold text-white shadow-md active:scale-[0.98]">
            <Camera className="size-9 shrink-0" aria-hidden />
            {t("home.camera")}
          </CameraLookupButton>
        </div>
      </div>
    </>
  );
}
