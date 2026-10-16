"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Download, FileSpreadsheet, LoaderCircle, Pencil, Plus, ScanBarcode, Search, Settings, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProductSearch } from "@/hooks/use-product-search";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";
import { useI18n } from "@/i18n/i18n-provider";

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
    <>
      <PageHeader title={t("admin.title")} backHref="/" />
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-4">
        <div className="grid gap-3">
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
          <Button asChild size="xl" className="h-auto min-h-20 whitespace-normal bg-action-scan py-3 text-center">
            <Link href="/admin/scan">
              <ScanBarcode aria-hidden />
              {t("admin.scanAdd")}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-auto min-h-14 whitespace-normal py-3">
            <Link href="/admin/products/new">
              <Plus aria-hidden />
              {t("admin.addManual")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start h-auto min-h-14 whitespace-normal py-3">
            <Link href="/admin/import">
              <FileSpreadsheet aria-hidden />
              {t("admin.import")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start h-auto min-h-14 whitespace-normal py-3">
            <a href="/api/products/export" download>
              <Download aria-hidden />
              {t("admin.export")}
            </a>
          </Button>
          <Button asChild variant="outline" className="justify-start h-auto min-h-14 whitespace-normal py-3">
            <Link href="/admin/settings">
              <Settings aria-hidden />
              {t("admin.settings")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start h-auto min-h-14 whitespace-normal py-3">
            <Link href="/admin/ai-settings">
              <Sparkles aria-hidden />
              {t("admin.aiSettings")}
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
      </main>
    </>
  );
}
