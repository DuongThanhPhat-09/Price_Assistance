"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Keyboard, LoaderCircle, Mic, MicOff, RefreshCw } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductListItem } from "@/components/product/product-list-item";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { api } from "@/lib/api-client";
import type { SearchResultDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";

type Phase =
  | { kind: "speech" }
  | { kind: "searching"; heard: string }
  | { kind: "choose"; heard: string; results: SearchResultDTO[] }
  | { kind: "not-found"; heard: string }
  | { kind: "failed"; heard: string };

export function VoiceScreen() {
  const { t, speechLang } = useI18n();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "speech" });

  /** Try each alternative the recogniser heard until one finds products. */
  const handleFinal = useCallback(
    async (alternatives: string[]) => {
      const heard = alternatives[0];
      setPhase({ kind: "searching", heard });
      try {
        for (const alt of alternatives) {
          const res = await api.search(alt, { limit: 10 });
          if (res.results.length === 0) continue;

          if (res.confidentMatchId) {
            // In Manage Products a found product opens for editing.
            router.push(`/admin/products/${res.confidentMatchId}/edit`);
            return;
          }
          // Only offer the close contenders, not every loose match.
          const top = res.results[0].score;
          const contenders = res.results.filter((r) => r.score >= top * 0.6).slice(0, 6);
          setPhase({ kind: "choose", heard: alt, results: contenders });
          return;
        }
        setPhase({ kind: "not-found", heard });
      } catch {
        setPhase({ kind: "failed", heard });
      }
    },
    [router],
  );

  const { status, interim, start, stop } = useSpeechRecognition({ lang: speechLang, onFinal: handleFinal });

  // Start listening as soon as the screen opens — the user already tapped "Voice".
  const autoStarted = useRef(false);
  useEffect(() => {
    if (status === "idle" && !autoStarted.current) {
      autoStarted.current = true;
      start();
    }
  }, [status, start]);

  const listenAgain = () => {
    setPhase({ kind: "speech" });
    start();
  };

  const listening = status === "listening" && phase.kind === "speech";

  let message: string;
  let isError = false;
  if (phase.kind === "searching") message = t("voice.searching");
  else if (phase.kind === "not-found") {
    message = t("voice.notFound", { q: phase.heard });
    isError = true;
  } else if (phase.kind === "failed") {
    message = t("common.error");
    isError = true;
  } else if (phase.kind === "choose") message = t("voice.pickOne");
  else if (status === "unsupported") {
    message = t("voice.unsupported");
    isError = true;
  } else if (status === "denied") {
    message = t("voice.denied");
    isError = true;
  } else if (status === "no-speech") message = t("voice.noSpeech");
  else if (status === "network") {
    message = t("common.offline");
    isError = true;
  }
  else if (status === "error") {
    message = t("common.error");
    isError = true;
  } else if (listening) message = t("voice.listening");
  else message = t("voice.tapToSpeak");

  const heardText = phase.kind === "speech" ? interim : phase.heard;
  const canListen = status !== "unsupported" && status !== "checking";
  const busy = phase.kind === "searching";

  return (
    <AdminShell>
      <div className="flex flex-col items-center pt-2 text-center">
        {/* Giant microphone button */}
        <div className="relative flex size-56 items-center justify-center">
          {listening && (
            <span aria-hidden className="absolute inset-4 rounded-full bg-action-voice/40 animate-pulse-ring" />
          )}
          <button
            type="button"
            disabled={!canListen || busy}
            onClick={listening ? stop : listenAgain}
            aria-label={listening ? t("voice.stop") : t("voice.tryAgain")}
            className={cn(
              "relative flex size-44 items-center justify-center rounded-full text-white shadow-xl transition-transform active:scale-95 disabled:opacity-60",
              status === "unsupported" || status === "denied" ? "bg-slate-500" : "bg-action-voice",
            )}
          >
            {busy ? (
              <LoaderCircle className="size-20 animate-spin" aria-hidden />
            ) : status === "unsupported" || status === "denied" ? (
              <MicOff className="size-20" aria-hidden />
            ) : (
              <Mic className="size-20" strokeWidth={2.25} aria-hidden />
            )}
          </button>
        </div>

        <p
          role="status"
          aria-live="polite"
          className={cn("mt-6 text-2xl font-bold leading-snug", isError && "text-destructive")}
        >
          {message}
        </p>

        {heardText && (
          <div className="mt-6 w-full rounded-2xl border-2 border-border bg-card p-5">
            <p className="text-lg text-muted-foreground">{t("voice.heard")}:</p>
            <p className="mt-1 text-3xl font-extrabold">“{heardText}”</p>
          </div>
        )}

        {phase.kind === "choose" && (
          <ul className="mt-6 w-full space-y-3 text-left">
            {phase.results.map(({ product }) => (
              <li key={product.id}>
                <ProductListItem
                  product={product}
                  onSelect={() => router.push(`/admin/products/${product.id}/edit`)}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Recovery actions — always visible after a problem */}
        {!listening && !busy && phase.kind !== "choose" && status !== "checking" && (
          <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
            {canListen && status !== "denied" && (
              <Button size="xl" onClick={listenAgain} className="bg-action-voice hover:bg-action-voice/90">
                <RefreshCw aria-hidden />
                {t("voice.tryAgain")}
              </Button>
            )}
            <Button asChild size="xl" variant="outline">
              <Link href={heardText ? `/admin/search?q=${encodeURIComponent(heardText)}` : "/admin/search"}>
                <Keyboard aria-hidden />
                {t("voice.typeInstead")}
              </Link>
            </Button>
          </div>
        )}

        {phase.kind === "choose" && (
          <Button size="lg" variant="outline" onClick={listenAgain} className="mt-6 w-full">
            <Mic aria-hidden />
            {t("voice.tryAgain")}
          </Button>
        )}

        {phase.kind === "speech" && canListen && (
          <p className="mt-10 text-xl text-muted-foreground">{t("voice.example")}</p>
        )}
      </div>
    </AdminShell>
  );
}
