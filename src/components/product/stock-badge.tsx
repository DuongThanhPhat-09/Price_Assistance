"use client";

import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { appConfig } from "@/lib/config";
import { useI18n } from "@/i18n/i18n-provider";

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(qty: number): StockLevel {
  if (qty <= 0) return "out";
  if (qty <= appConfig.lowStockThreshold) return "low";
  return "ok";
}

/** Colour + icon + words — never colour alone, for colour-blind users. */
export function StockBadge({ quantity, className }: { quantity: number; className?: string }) {
  const { t } = useI18n();
  const level = stockLevel(quantity);
  if (level === "out") {
    return (
      <Badge variant="destructive" className={className}>
        <CircleX aria-hidden /> {t("product.outOfStock")}
      </Badge>
    );
  }
  if (level === "low") {
    return (
      <Badge variant="warning" className={className}>
        <CircleAlert aria-hidden /> {t("product.lowStock")}
      </Badge>
    );
  }
  return (
    <Badge variant="success" className={className}>
      <CircleCheck aria-hidden /> {t("product.inStock")}
    </Badge>
  );
}
