"use client";

import { ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";
import { ProductImage } from "./product-image";
import { stockLevel } from "./stock-badge";

/**
 * One big, tappable result row: picture, name, price, stock.
 * The whole row is the button — no small targets.
 */
export function ProductListItem({
  product,
  onSelect,
  className,
}: {
  product: Pick<ProductDTO, "id" | "name" | "price" | "category" | "imageUrl" | "stockQuantity" | "shelfLocation">;
  onSelect: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const level = stockLevel(product.stockQuantity);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary active:bg-accent",
        className,
      )}
    >
      <ProductImage
        src={product.imageUrl}
        alt=""
        category={product.category}
        className="size-20 shrink-0 rounded-xl"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-lg font-semibold leading-snug">{product.name}</p>
        <p className="mt-1 text-2xl font-extrabold text-price">{formatMoney(product.price)}</p>
        <p
          className={cn(
            "text-base font-medium",
            level === "out" ? "text-destructive" : level === "low" ? "text-warning" : "text-muted-foreground",
          )}
        >
          {level === "out" ? t("product.outOfStock") : `${t("product.stock")}: ${product.stockQuantity}`}
          {product.shelfLocation ? ` · ${t("product.location")} ${product.shelfLocation}` : ""}
        </p>
      </div>
      <ChevronRight className="size-8 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
