"use client";

import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/recognition/matching";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";

const HIGH_CONFIDENCE = 0.85;

/** "Confidence 92% · High" with a bar; colour + word, never colour alone. */
export function ConfidenceMeter({ confidence, footer }: { confidence: number; footer?: string }) {
  const { t } = useI18n();
  const percent = Math.round(confidence * 100);
  const level = confidence >= HIGH_CONFIDENCE ? "high" : confidence >= LOW_CONFIDENCE_THRESHOLD ? "good" : "low";
  const color = { high: "bg-success", good: "bg-primary", low: "bg-warning" }[level];
  const text = { high: "text-success", good: "text-primary", low: "text-warning" }[level];

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-lg font-semibold">{t("review.confidence")}</p>
        <p className={cn("text-3xl font-black", text)}>
          {percent}% <span className="text-lg font-bold">· {t(`review.level.${level}`)}</span>
        </p>
      </div>
      <div
        role="meter"
        aria-label={t("review.confidence")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-3 h-4 overflow-hidden rounded-full bg-secondary"
      >
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(4, percent)}%` }} />
      </div>
      {footer && <p className="mt-2 text-base text-muted-foreground">{footer}</p>}
    </div>
  );
}
