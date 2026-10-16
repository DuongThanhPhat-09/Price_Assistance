"use client";

import { CircleCheck, LoaderCircle, Plus } from "lucide-react";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { ProductMatchDTO } from "@/lib/types";
import { useI18n } from "@/i18n/i18n-provider";

/** "Possible Match Found": pick an existing product instead of creating a duplicate. */
export function PossibleMatches({
  matches,
  busyId,
  onUse,
  onDismiss,
}: {
  matches: ProductMatchDTO[];
  busyId: number | null;
  onUse: (productId: number) => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();

  return (
    <section aria-labelledby="matches-title" className="rounded-3xl border-2 border-primary bg-accent p-4">
      <h2 id="matches-title" className="text-2xl font-extrabold">
        {t("match.title")}
      </h2>
      <p className="mt-1 text-lg leading-snug">{t("match.hint")}</p>

      <ul className="mt-4 space-y-3">
        {matches.map((m) => (
          <li key={m.product.id} className="rounded-2xl border-2 border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <ProductImage
                src={m.product.imageUrl}
                alt=""
                category={m.product.category}
                className="size-20 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-lg font-bold leading-snug">{m.product.name}</p>
                <p className="text-lg font-bold text-price">{formatMoney(m.product.price)}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-base text-muted-foreground">
                  <span className="font-bold text-primary">{t("match.percent", { n: Math.round(m.score * 100) })}</span>
                  {m.reasons.slice(0, 2).map((r) => (
                    <span key={r}>{t(`match.reason.${r}`)}</span>
                  ))}
                </p>
              </div>
            </div>
            <Button className="mt-3 w-full" disabled={busyId !== null} onClick={() => onUse(m.product.id)}>
              {busyId === m.product.id ? <LoaderCircle className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
              {t("match.use")}
            </Button>
          </li>
        ))}
      </ul>

      <Button variant="outline" className="mt-3 h-auto min-h-14 w-full whitespace-normal py-3" onClick={onDismiss}>
        <Plus aria-hidden />
        {t("match.new")}
      </Button>
    </section>
  );
}
