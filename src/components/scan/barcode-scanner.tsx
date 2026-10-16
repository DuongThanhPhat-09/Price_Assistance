"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, LoaderCircle } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";

const READER_ID = "barcode-reader";

type CameraState = "starting" | "scanning" | "denied" | "no-camera" | "insecure" | "error";

/**
 * Live camera barcode reader (html5-qrcode). Uses the phone's native
 * BarcodeDetector when available for fast, reliable reads, and falls back
 * to the bundled ZXing decoder elsewhere. Calls `onDetected` once per code.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<CameraState>("starting");
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!window.isSecureContext) {
      setState("insecure");
      return;
    }

    let cancelled = false;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let startPromise: Promise<unknown> | null = null;

    (async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
      if (cancelled) return;

      scanner = new Html5Qrcode(READER_ID, {
        verbose: false,
        useBarCodeDetectorIfSupported: true,
        formatsToSupport: [
          F.EAN_13,
          F.EAN_8,
          F.UPC_A,
          F.UPC_E,
          F.CODE_128,
          F.CODE_39,
          F.ITF,
          F.QR_CODE,
        ],
      });

      startPromise = scanner.start(
        { facingMode: "environment" },
        { fps: 12, disableFlip: true },
        (text) => onDetectedRef.current(text.trim()),
        () => undefined, // "no code in this frame" — ignore
      );

      try {
        await startPromise;
        if (!cancelled) setState("scanning");
      } catch (err) {
        if (cancelled) return;
        const msg = String(err);
        if (/NotAllowed|Permission/i.test(msg)) setState("denied");
        else if (/NotFound|no camera|Requested device not found|OverconstrainedError/i.test(msg)) setState("no-camera");
        else setState("error");
      }
    })();

    return () => {
      cancelled = true;
      void (async () => {
        try {
          await startPromise;
        } catch {
          /* never started */
        }
        try {
          if (scanner?.isScanning) await scanner.stop();
          scanner?.clear();
        } catch {
          /* already stopped */
        }
      })();
    };
  }, []);

  const problem =
    state === "denied"
      ? t("scan.denied")
      : state === "no-camera"
        ? t("scan.noCamera")
        : state === "insecure"
          ? t("scan.insecure")
          : state === "error"
            ? t("common.error")
            : null;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-black">
      <div id={READER_ID} className="absolute inset-0" />

      {state === "scanning" && (
        // Guide frame: where to put the barcode.
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-2/5 w-4/5 rounded-2xl border-4 border-white/90 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]">
            <div className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_12px_2px_rgba(239,68,68,0.8)]" />
          </div>
        </div>
      )}

      {state === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
          <LoaderCircle className="size-14 animate-spin" aria-hidden />
          <p className="text-xl font-semibold">{t("scan.starting")}</p>
        </div>
      )}

      {problem && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-center text-white">
          <CameraOff className="size-16" aria-hidden />
          <p className="text-xl font-semibold leading-snug">{problem}</p>
        </div>
      )}
    </div>
  );
}
