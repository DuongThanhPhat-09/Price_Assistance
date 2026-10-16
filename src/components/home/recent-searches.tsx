"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Mic, ScanBarcode, Search, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { RecentSearchDTO, SearchType } from "@/lib/types";
import { useI18n } from "@/i18n/i18n-provider";
import { ProductImage } from "@/components/product/product-image";

const typeIcon: Record<SearchType, LucideIcon> = {
  barcode: ScanBarcode,
  voice: Mic,
  text: Search,
  image: Search,
};

export function RecentSearches() {
  const { t, formatRelative } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<RecentSearchDTO[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .recent(6)
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  const open = (item: RecentSearchDTO) => {
    if (item.product) router.push(`/product/${item.product.id}`);
    else router.push(`/search?q=${encodeURIComponent(item.keyword)}`);
  };

  return (
    <section aria-labelledby="recent-title" className="mt-10">
      <h2 id="recent-title" className="mb-4 flex items-center gap-3 text-2xl font-bold">
        <History className="size-7" aria-hidden />
        {t("home.recent")}
      </h2>

      {items === null ? (
        <div className="space-y-3" aria-busy="true" aria-label={t("common.loading")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-lg text-muted-foreground">
          {t("home.recentEmpty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const TypeIcon = typeIcon[item.searchType] ?? Search;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card p-3 text-left shadow-sm hover:border-primary active:bg-accent"
                >
                  {item.product ? (
                    <ProductImage
                      src={item.product.imageUrl}
                      alt=""
                      category={item.product.category}
                      className="size-16 shrink-0 rounded-xl"
                    />
                  ) : (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-secondary">
                      <TypeIcon className="size-8" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-lg font-semibold leading-snug">
                      {item.product?.name ?? `“${item.keyword}”`}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-base text-muted-foreground">
                      {item.product && (
                        <span className="text-xl font-extrabold text-price">{formatMoney(item.product.price)}</span>
                      )}
                      <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                        <TypeIcon className="size-4" aria-hidden />
                        {formatRelative(item.createdAt)}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
