"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, CameraOff, Lightbulb, LoaderCircle } from "lucide-react";
import type { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { ensureBarcodeDetector } from "@/lib/barcode-detector";
import { useI18n } from "@/i18n/i18n-provider";

const READER_ID = "barcode-reader";
const FILE_READER_ID = "barcode-file-reader";

/**
 * html5-qrcode decodes each frame on a canvas the size of the reader element
 * in CSS pixels. On a phone that is ~360px wide, which squeezes a 95-module
 * EAN-13 to under one pixel per bar — unreadable unless the barcode fills
 * the screen. So the reader is laid out at a fixed, camera-like resolution
 * and scaled down visually with a CSS transform.
 */
const DECODE_WIDTH = 1280;
const DECODE_HEIGHT = 960; // 4:3, same as the on-screen viewfinder

/** Largest side of a photo before decoding (phone photos can be 12+ MP). */
const PHOTO_MAX_SIDE = 2000;
/** Show positioning tips if nothing was read after this long. */
const TIP_AFTER_MS = 10_000;

type CameraState = "starting" | "scanning" | "denied" | "no-camera" | "insecure" | "error";

async function supportedFormats(): Promise<Html5QrcodeSupportedFormats[]> {
  const { Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
  return [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE];
}

/** Downscales a photo and returns it upright plus rotated 90° (vertical barcodes). */
async function photoVariants(file: File): Promise<File[]> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const render = (rotate: boolean) =>
    new Promise<File>((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = rotate ? h : w;
      canvas.height = rotate ? w : h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      if (rotate) {
        ctx.translate(h, 0);
        ctx.rotate(Math.PI / 2);
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(new File([blob], "barcode.jpg", { type: "image/jpeg" })) : reject(new Error("toBlob"))),
        "image/jpeg",
        0.92,
      );
    });

  const variants = [await render(false), await render(true)];
  bitmap.close();
  return variants;
}

/**
 * Live camera barcode reader (html5-qrcode) with a "take a photo" fallback.
 * Uses the phone's native BarcodeDetector when available and the bundled
 * ZXing decoder elsewhere. Calls `onDetected` with each code it reads.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<CameraState>("starting");
  const [scale, setScale] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  // Keep the full-resolution reader visually fitted to the viewfinder box.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setScale(box.clientWidth / DECODE_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!window.isSecureContext) {
      setState("insecure");
      return;
    }

    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    let startPromise: Promise<unknown> | null = null;

    (async () => {
      await ensureBarcodeDetector(); // before the constructor picks a decoder
      const { Html5Qrcode } = await import("html5-qrcode");
      const formats = await supportedFormats();
      if (cancelled) return;

      scanner = new Html5Qrcode(READER_ID, {
        verbose: false,
        useBarCodeDetectorIfSupported: true,
        formatsToSupport: formats,
      });

      startPromise = scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          // Decode only a wide band around the on-screen guide frame.
          qrbox: (w, h) => ({ width: Math.floor(w * 0.9), height: Math.floor(h * 0.5) }),
          // html5-qrcode's "flip" mode leaves the canvas mirrored for every
          // other frame (and getUserMedia frames are never mirrored anyway).
          disableFlip: true,
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // Continuous autofocus where supported (not in the TS DOM types yet).
            advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
          },
        },
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

  useEffect(() => {
    if (state !== "scanning") return;
    const timer = setTimeout(() => setShowTip(true), TIP_AFTER_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setPhotoFailed(false);
    try {
      await ensureBarcodeDetector();
      const { Html5Qrcode } = await import("html5-qrcode");
      const reader = new Html5Qrcode(FILE_READER_ID, {
        verbose: false,
        useBarCodeDetectorIfSupported: true,
        formatsToSupport: await supportedFormats(),
      });
      try {
        for (const variant of await photoVariants(file)) {
          try {
            const text = await reader.scanFile(variant, false);
            onDetectedRef.current(text.trim());
            return;
          } catch {
            /* try the next orientation */
          }
        }
        setPhotoFailed(true);
      } finally {
        reader.clear();
      }
    } catch {
      setPhotoFailed(true);
    } finally {
      setPhotoBusy(false);
    }
  };

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
    <div>
      <div ref={boxRef} className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-black">
        <div
          id={READER_ID}
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: DECODE_WIDTH,
            height: DECODE_HEIGHT,
            transform: `scale(${scale})`,
            visibility: scale ? "visible" : "hidden",
          }}
        />

        {state === "scanning" && (
          // Guide frame: where to put the barcode (inside the decoded band).
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-2/5 w-4/5 rounded-2xl border-4 border-white/90 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]">
              <div className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_12px_2px_rgba(239,68,68,0.8)]" />
            </div>
          </div>
        )}

        {(state === "starting" || photoBusy) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 text-white">
            <LoaderCircle className="size-14 animate-spin" aria-hidden />
            <p className="text-xl font-semibold">{photoBusy ? t("scan.photoReading") : t("scan.starting")}</p>
          </div>
        )}

        {problem && !photoBusy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-center text-white">
            <CameraOff className="size-16" aria-hidden />
            <p className="text-xl font-semibold leading-snug">{problem}</p>
          </div>
        )}
      </div>

      {showTip && !photoFailed && (
        <p role="status" className="mt-4 flex gap-3 rounded-2xl bg-amber-50 p-4 text-lg leading-snug ring-2 ring-amber-200">
          <Lightbulb className="mt-0.5 size-6 shrink-0 text-warning" aria-hidden />
          {t("scan.tip")}
        </p>
      )}
      {photoFailed && (
        <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 p-4 text-lg font-medium leading-snug text-destructive">
          {t("scan.photoFailed")}
        </p>
      )}

      {/* Fallback: the phone's own camera app takes a sharp, focused photo. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onPhoto(e)}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-4 w-full"
        disabled={photoBusy}
        onClick={() => fileRef.current?.click()}
      >
        <Camera aria-hidden />
        {t("scan.photo")}
      </Button>
      <div id={FILE_READER_ID} className="hidden" />
    </div>
  );
}
