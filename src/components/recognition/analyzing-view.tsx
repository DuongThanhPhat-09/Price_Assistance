"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/i18n-provider";

export type AnalyzePhase = "prepare" | "upload";

/**
 * The AI answers in one response, so there is no real progress to report.
 * Instead the bar eases towards 92 % and the caption walks through what is
 * happening, which keeps a 5–10 s wait feeling short and alive.
 */
const STAGES: { after: number; key: MessageKey }[] = [
  { after: 0, key: "detect.stage.upload" },
  { after: 1500, key: "detect.stage.read" },
  { after: 4500, key: "detect.stage.identify" },
  { after: 8000, key: "detect.stage.match" },
];

export function AnalyzingView({
  previewUrl,
  phase,
  onCancel,
}: {
  previewUrl: string | null;
  phase: AnalyzePhase;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== "upload") return;
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - start), 200);
    return () => clearInterval(timer);
  }, [phase]);

  const progress = phase === "prepare" ? 6 : Math.round(10 + 82 * (1 - Math.exp(-elapsed / 5000)));
  const stage =
    phase === "prepare" ? "detect.stage.prepare" : [...STAGES].reverse().find((s) => elapsed >= s.after)!.key;

  return (
    <div className="space-y-5" aria-busy="true">
      <div className="relative overflow-hidden rounded-3xl border-2 border-border bg-white">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={previewUrl} alt="" className="aspect-[4/3] w-full object-contain" />
        ) : (
          <div className="aspect-[4/3] w-full bg-secondary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-action-detect/10 to-action-detect/30 motion-safe:animate-pulse" />
      </div>

      <div className="rounded-2xl border-2 border-border bg-card p-5 text-center">
        <p className="flex items-center justify-center gap-3 text-2xl font-extrabold">
          <LoaderCircle className="size-8 animate-spin text-action-detect" aria-hidden />
          {t("detect.analyzing")}
        </p>
        <div
          role="progressbar"
          aria-label={t("detect.analyzing")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="mt-4 h-4 overflow-hidden rounded-full bg-secondary"
        >
          <div className="h-full rounded-full bg-action-detect transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-lg text-muted-foreground" aria-live="polite">
          {t(stage)}
        </p>
      </div>

      <Button variant="outline" size="lg" className="w-full" onClick={onCancel}>
        {t("common.cancel")}
      </Button>
    </div>
  );
}
