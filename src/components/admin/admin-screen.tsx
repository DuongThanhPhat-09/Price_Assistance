"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, LoaderCircle, Pencil, Plus, Search } from "lucide-react";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProductSearch } from "@/hooks/use-product-search";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";
import { useI18n } from "@/i18n/i18n-provider";
import { AdminShell } from "./admin-shell";

const PAGE_SIZE = 50;

/** Whole row opens the editor — one big target instead of small icons. */
function AdminRow({ product }: { product: ProductDTO }) {
  const { t } = useI18n();
  return (
    <li>
      <Link
        href={`/admin/products/${product.id}/edit`}
        aria-label={`${t("common.edit")} ${product.name}`}
        className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3 hover:border-primary active:bg-accent"
      >
        <ProductImage src={product.imageUrl} alt="" category={product.category} className="size-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-lg font-semibold leading-snug">{product.name}</p>
          <p className="text-base text-muted-foreground">
            <span className="font-bold text-price">{formatMoney(product.price)}</span>
            {" · "}
            {t("product.stock")}: {product.stockQuantity}
            {product.shelfLocation ? ` · ${product.shelfLocation}` : ""}
          </p>
        </div>
        <Pencil className="size-7 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

export function AdminScreen() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState<ProductDTO[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loadingPage, setLoadingPage] = useState(false);
  const search = useProductSearch(filter, { delayMs: 150 });

  const loadPage = useCallback(async (p: number) => {
    setLoadingPage(true);
    try {
      const res = await api.list(p, PAGE_SIZE);
      setItems((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
      setTotal(res.total);
      setPage(p);
    } finally {
      setLoadingPage(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  const filtering = filter.trim().length > 0;
  const shown = filtering ? search.results.map((r) => r.product) : items;

  return (
    <AdminShell>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          asChild
          size="xl"
          className="h-auto min-h-24 flex-col gap-1 whitespace-normal bg-action-detect py-3 text-center text-white hover:bg-action-detect/90"
        >
          <Link href="/admin/detect">
            <span className="flex items-center gap-3">
              <Camera aria-hidden />
              {t("admin.detect")}
            </span>
            <span className="text-lg font-medium opacity-95">{t("admin.detectHint")}</span>
          </Link>
        </Button>
        <Button asChild size="xl" variant="outline" className="h-auto min-h-24 whitespace-normal py-3 text-center">
          <Link href="/admin/products/new">
            <Plus aria-hidden />
            {t("admin.addManual")}
          </Link>
        </Button>
      </div>

      <div className="relative mt-8">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("admin.filter")}
          aria-label={t("admin.filter")}
          className="h-16 pl-13 text-xl"
        />
      </div>

      {total !== null && !filtering && (
        <p className="mt-4 text-lg font-medium text-muted-foreground">{t("admin.total", { n: total })}</p>
      )}

      {total === 0 && !filtering ? (
        <p className="mt-6 rounded-2xl border-2 border-dashed border-border p-6 text-center text-lg text-muted-foreground">
          {t("admin.empty")}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((p) => (
            <AdminRow key={p.id} product={p} />
          ))}
        </ul>
      )}

      {(loadingPage || (filtering && search.loading && shown.length === 0)) && (
        <div className="mt-6 flex justify-center">
          <LoaderCircle className="size-10 animate-spin text-primary" aria-label={t("common.loading")} />
        </div>
      )}

      {!filtering && total !== null && items.length < total && !loadingPage && (
        <Button variant="outline" size="lg" className="mt-6 w-full" onClick={() => loadPage(page + 1)}>
          {t("admin.loadMore")}
        </Button>
      )}
    </AdminShell>
  );
}
