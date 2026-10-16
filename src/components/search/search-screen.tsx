"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search, SearchX, X } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductListItem } from "@/components/product/product-list-item";
import { Button } from "@/components/ui/button";
import { useProductSearch } from "@/hooks/use-product-search";
import { api } from "@/lib/api-client";
import { useI18n } from "@/i18n/i18n-provider";
import { useSearchStore } from "@/store/search-store";

const EXAMPLES = ["ống nước 27", "bóng led", "panasonic", "dây điện 2.5", "van khoá"];

export function SearchScreen({ initialQuery }: { initialQuery?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const store = useSearchStore();
  const [query, setQuery] = useState(initialQuery ?? store.query);
  const { results, resultsFor, loading, error } = useProductSearch(query, {
    initial: store.resultsFor === query ? { for: store.resultsFor, results: store.results } : undefined,
  });

  // Remember the search so Back from a product returns to these results.
  useEffect(() => {
    store.setQuery(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => {
    store.setResults(resultsFor, results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, resultsFor]);

  // In Manage Products a found product opens for editing.
  const openProduct = (id: number) => router.push(`/admin/products/${id}/edit`);

  /**
   * Enter key: open the product directly when the match is unambiguous.
   * This also makes USB/Bluetooth barcode scanners (which type the number
   * and press Enter) work with zero taps.
   */
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    try {
      const res = await api.search(q, { limit: 30 });
      if (res.confidentMatchId) {
        openProduct(res.confidentMatchId);
        return;
      }
    } catch {
      /* fall through: results list is still shown */
    }
    inputRef.current?.blur(); // hide the keyboard so results are visible
  };

  const clear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const trimmed = query.trim();
  const showEmpty = trimmed && !loading && resultsFor === trimmed && results.length === 0;

  return (
    <AdminShell>
      <form role="search" onSubmit={onSubmit} className="sticky top-20 z-20 -mx-4 -mt-6 bg-background px-4 pb-3 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-7 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            className="h-18 w-full rounded-2xl border-[3px] border-primary bg-card pl-14 pr-16 text-2xl font-medium shadow-sm placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              aria-label={t("search.clear")}
              className="absolute right-2 top-1/2 flex size-14 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
            >
              <X className="size-8" aria-hidden />
            </button>
          )}
        </div>
      </form>

      <div aria-live="polite" className="sr-only">
        {resultsFor && !loading ? t("search.count", { n: results.length }) : ""}
      </div>

      {!trimmed && (
        <div className="mt-6">
          <p className="text-xl text-muted-foreground">{t("search.startTyping")}</p>
          <p className="mt-6 text-lg font-semibold">{t("search.examples")}:</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {EXAMPLES.map((ex) => (
              <Button key={ex} variant="outline" onClick={() => setQuery(ex)} className="h-12 rounded-full text-lg">
                {ex}
              </Button>
            ))}
          </div>
        </div>
      )}

      {trimmed && loading && results.length === 0 && (
        <div className="mt-10 flex justify-center" aria-label={t("common.loading")}>
          <LoaderCircle className="size-12 animate-spin text-primary" aria-hidden />
        </div>
      )}

      {error && <p className="mt-6 rounded-xl bg-destructive/10 p-4 text-lg text-destructive">{t("common.error")}</p>}

      {showEmpty && (
        <div className="mt-10 flex flex-col items-center text-center">
          <SearchX className="size-16 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-2xl font-bold">{t("search.noResults", { q: trimmed })}</p>
          <p className="mt-2 text-lg text-muted-foreground">{t("search.noResultsHint")}</p>
        </div>
      )}

      {results.length > 0 && trimmed && (
        <>
          <p className="mb-3 mt-2 text-lg font-medium text-muted-foreground">
            {t("search.count", { n: results.length })}
          </p>
          <ul className="space-y-3">
            {results.map(({ product }) => (
              <li key={product.id}>
                <ProductListItem product={product} onSelect={() => openProduct(product.id)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminShell>
  );
}
