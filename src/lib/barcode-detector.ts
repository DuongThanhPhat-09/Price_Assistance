/**
 * Makes `window.BarcodeDetector` available in every browser.
 *
 * html5-qrcode prefers the browser's BarcodeDetector and otherwise falls back
 * to zxing-js, whose 1D-barcode binarizer fails on slightly blurred camera
 * frames — so EAN/UPC codes on real products often never scan. Android
 * Chrome has a native detector; iPhone Safari, Windows/Linux Chrome & Edge
 * and Firefox do not. For those we install a detector backed by ZXing-C++
 * (WebAssembly), which is far more tolerant of blur.
 *
 * Camera frames are often contrast-boosted with clipped whites, which defeats
 * any single thresholding strategy, so each frame is tried with up to three
 * binarizers (each pass takes ~5–15 ms).
 *
 * Must be awaited before creating an Html5Qrcode instance, because
 * html5-qrcode picks its decoder in the constructor.
 */
import type { ReaderOptions, ReadResult } from "zxing-wasm/reader";

/** W3C Barcode Detection API format name → ZXing-C++ format name. */
const W3C_TO_ZXING: Record<string, string> = {
  ean_13: "EAN13",
  ean_8: "EAN8",
  upc_a: "UPCA",
  upc_e: "UPCE",
  code_128: "Code128",
  code_39: "Code39",
  code_93: "Code93",
  codabar: "Codabar",
  itf: "ITF",
  qr_code: "QRCode",
  data_matrix: "DataMatrix",
  pdf417: "PDF417",
  aztec: "Aztec",
};

const normalize = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
const ZXING_TO_W3C = new Map(Object.entries(W3C_TO_ZXING).map(([w3c, zx]) => [normalize(zx), w3c]));

/** "EAN-13" / "EAN13" → "ean_13" */
export function toW3CFormat(zxingFormat: string): string {
  return ZXING_TO_W3C.get(normalize(zxingFormat)) ?? "unknown";
}

const BINARIZER_PASSES: NonNullable<ReaderOptions["binarizer"]>[] = ["LocalAverage", "FixedThreshold", "GlobalHistogram"];

type Reader = typeof import("zxing-wasm/reader");
let readerPromise: Promise<Reader> | null = null;

function loadReader(): Promise<Reader> {
  readerPromise ??= (async () => {
    const reader = await import("zxing-wasm/reader");
    // Serve the .wasm from our own origin (copied by scripts/copy-zxing-wasm.mjs).
    await reader.prepareZXingModule({
      overrides: {
        locateFile: (file: string, prefix: string) => (file.endsWith(".wasm") ? `/zxing/${file}` : prefix + file),
      },
      fireImmediately: true,
    });
    return reader;
  })();
  return readerPromise;
}

function toImageData(source: CanvasImageSource | ImageData): ImageData {
  if (source instanceof ImageData) return source;
  if (source instanceof HTMLCanvasElement) {
    const ctx = source.getContext("2d", { willReadFrequently: true });
    if (ctx) return ctx.getImageData(0, 0, source.width, source.height);
  }
  const w = "videoWidth" in source ? source.videoWidth : (source as { width: number }).width;
  const h = "videoHeight" in source ? source.videoHeight : (source as { height: number }).height;
  const canvas = document.createElement("canvas");
  canvas.width = Number(w);
  canvas.height = Number(h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new DOMException("No 2D context", "NotSupportedError");
  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function toDetected(r: ReadResult) {
  const { topLeft, topRight, bottomLeft, bottomRight } = r.position;
  const xs = [topLeft.x, topRight.x, bottomLeft.x, bottomRight.x];
  const ys = [topLeft.y, topRight.y, bottomLeft.y, bottomRight.y];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    rawValue: r.text,
    format: toW3CFormat(r.format),
    boundingBox: new DOMRectReadOnly(x, y, Math.max(...xs) - x, Math.max(...ys) - y),
    cornerPoints: [topLeft, topRight, bottomRight, bottomLeft],
  };
}

/** Subset of the W3C BarcodeDetector API that html5-qrcode uses. */
class ZXingBarcodeDetector {
  private readonly formats: string[];

  constructor(options?: { formats?: string[] }) {
    this.formats = (options?.formats ?? []).map((f) => W3C_TO_ZXING[f]).filter(Boolean);
  }

  static async getSupportedFormats(): Promise<string[]> {
    return Object.keys(W3C_TO_ZXING);
  }

  async detect(source: CanvasImageSource | ImageData) {
    const { readBarcodes } = await loadReader();
    const imageData = toImageData(source);
    for (const binarizer of BINARIZER_PASSES) {
      const results = await readBarcodes(imageData, {
        formats: this.formats as ReaderOptions["formats"],
        binarizer,
        tryHarder: true,
        tryRotate: true, // barcode held vertically
        tryInvert: false,
        tryDownscale: true,
        maxNumberOfSymbols: 1,
      });
      if (results.length > 0) return results.map(toDetected);
    }
    return [];
  }
}

let ready: Promise<void> | null = null;

export function ensureBarcodeDetector(): Promise<void> {
  if (typeof window === "undefined" || "BarcodeDetector" in window) return Promise.resolve();

  ready ??= (async () => {
    try {
      await loadReader(); // fail here (not mid-scan) if the .wasm can't load
      (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = ZXingBarcodeDetector;
    } catch (e) {
      // Not fatal: html5-qrcode keeps working with its built-in decoder.
      console.warn("[scanner] ZXing-C++ decoder unavailable", e);
    }
  })();
  return ready;
}

/**
 * Reads a retail barcode (EAN/UPC) from a still image, or null. Never
 * throws: a photo without a barcode is the normal case.
 */
export async function detectRetailBarcode(source: CanvasImageSource): Promise<string | null> {
  try {
    await ensureBarcodeDetector();
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => ZXingBarcodeDetector })
      .BarcodeDetector;
    if (!Detector) return null;
    const results = await new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }).detect(source);
    return results[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}
