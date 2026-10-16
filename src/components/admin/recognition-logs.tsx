"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { RecognitionLogDTO, RecognitionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";

const PAGE = 20;
const PROVIDER_LABEL = { openai: "OpenAI", gemini: "Gemini" } as const;

const STATUS_STYLE: Record<RecognitionStatus, string> = {
  recognized: "bg-secondary text-foreground",
  saving: "bg-secondary text-foreground",
  failed: "bg-red-50 text-destructive",
  created: "bg-emerald-50 text-success",
  linked: "bg-blue-50 text-primary",
};

/** Admin "Recognition logs": every photo analysed, newest first. */
export function RecognitionLogs() {
  const { t, formatRelative } = useI18n();
  const [items, setItems] = useState<RecognitionLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (before?: number) => {
    setLoading(true);
    try {
      const page = await api.recognitions({ limit: PAGE, before });
      setItems((prev) => (before ? [...prev, ...page] : page));
      setHasMore(page.length === PAGE);
    } catch {
      /* the section simply stays empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-labelledby="logs-title" className="space-y-4">
      <h2 id="logs-title" className="text-2xl font-extrabold">
        {t("aiSettings.logs")}
      </h2>

      {!loading && items.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-lg text-muted-foreground">
          {t("aiSettings.logsEmpty")}
        </p>
      )}

      <ul className="space-y-3">
        {items.map((log) => (
          <li key={log.id} className="flex gap-3 rounded-2xl border-2 border-border bg-card p-3">
            <ProductImage src={log.imageUrl} alt="" category="-" className="size-16 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="line-clamp-2 text-lg font-semibold leading-snug">
                {log.product ? (
                  <Link href={`/admin/products/${log.product.id}/edit`} className="text-primary underline">
                    {log.product.name}
                  </Link>
                ) : (
                  log.recognizedName || t("aiSettings.unnamed")
                )}
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
                <span className={cn("rounded-full px-3 py-0.5 text-sm font-bold", STATUS_STYLE[log.status])}>
                  {t(`aiSettings.status.${log.status}`)}
                </span>
                {log.confidence !== null && <span className="font-semibold">{Math.round(log.confidence * 100)}%</span>}
                <span>
                  {PROVIDER_LABEL[log.provider] ?? log.provider}
                  {log.aiModel ? ` · ${log.aiModel}` : ""}
                </span>
                {log.durationMs !== null && <span>{(log.durationMs / 1000).toFixed(1)} s</span>}
                <span suppressHydrationWarning>{formatRelative(log.createdAt)}</span>
              </p>
              {log.error && <p className="line-clamp-2 break-all text-sm text-destructive">{log.error}</p>}
            </div>
          </li>
        ))}
      </ul>

      {loading && (
        <div className="flex justify-center">
          <LoaderCircle className="size-10 animate-spin text-primary" aria-label={t("common.loading")} />
        </div>
      )}
      {!loading && hasMore && (
        <Button variant="outline" size="lg" className="w-full" onClick={() => void load(items.at(-1)?.id)}>
          {t("admin.loadMore")}
        </Button>
      )}
    </section>
  );
}
