"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal Web Speech API typings (not yet in TypeScript's lib.dom). */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechStatus =
  | "checking" // before mount: support not known yet
  | "idle"
  | "listening"
  | "unsupported"
  | "denied"
  | "no-speech"
  | "network" // recognition runs on a server (Chrome/Edge) → needs internet
  | "error";

/**
 * Wraps the browser Web Speech API.
 * `onFinal` receives every alternative the engine heard, best first, so the
 * caller can try the next guess if the first one finds nothing.
 */
export function useSpeechRecognition({
  lang,
  onFinal,
}: {
  lang: string;
  onFinal: (alternatives: string[]) => void;
}) {
  const [status, setStatus] = useState<SpeechStatus>("checking");
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const gotFinal = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setStatus(getRecognitionCtor() ? "idle" : "unsupported");
    return () => recognitionRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    recognitionRef.current?.abort();

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    gotFinal.current = false;

    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          gotFinal.current = true;
          const alts: string[] = [];
          for (let a = 0; a < result.length; a++) {
            const tr = result[a].transcript.trim();
            if (tr && !alts.includes(tr)) alts.push(tr);
          }
          setInterim(alts[0] ?? "");
          if (alts.length) onFinalRef.current(alts);
        } else {
          text += result[0].transcript;
        }
      }
      if (!gotFinal.current) setInterim(text);
    };

    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setStatus("denied");
      else if (e.error === "no-speech") setStatus("no-speech");
      else if (e.error === "network") setStatus("network");
      else setStatus("error");
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setStatus((s) => (s === "listening" ? (gotFinal.current ? "idle" : "no-speech") : s));
    };

    recognitionRef.current = rec;
    setInterim("");
    setStatus("listening");
    try {
      rec.start();
    } catch {
      setStatus("error");
    }
  }, [lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { status, interim, start, stop };
}
