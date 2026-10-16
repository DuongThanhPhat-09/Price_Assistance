import { detectRetailBarcode } from "./barcode-detector";

/**
 * Browser-side photo preparation for Smart Product Recognition.
 *
 * Phone photos are 3–12 MB. We send the AI a ~1600 px JPEG (a few hundred
 * KB: fast on shop Wi-Fi, under Vercel's 4.5 MB body limit, still sharp
 * enough for small print) plus a ~480 px thumbnail that becomes the
 * product picture. A barcode is read from the same photo on the phone
 * (checksum-verified, unlike digits the AI reads).
 */

const ANALYSIS_MAX_SIDE = 1600;
const THUMBNAIL_MAX_SIDE = 480;
const BARCODE_TIMEOUT_MS = 2000;
const UPLOADABLE = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface PreparedPhoto {
  photo: Blob;
  thumbnail: Blob | null;
  barcode: string | null;
}

export class UnsupportedPhotoError extends Error {
  constructor() {
    super("This photo format cannot be used");
    this.name = "UnsupportedPhotoError";
  }
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/** Decodes the file upright (EXIF rotation applied). */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* older Safari: fall back to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new UnsupportedPhotoError();
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

function draw(img: Decoded, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UnsupportedPhotoError();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new UnsupportedPhotoError())), "image/jpeg", quality),
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let img: Decoded;
  try {
    img = await decode(file);
  } catch {
    // Can't decode here (e.g. HEIC outside Safari): send as-is if the server accepts it.
    if (UPLOADABLE.has(file.type) && file.size <= MAX_UPLOAD_BYTES) return { photo: file, thumbnail: null, barcode: null };
    throw new UnsupportedPhotoError();
  }

  try {
    const canvas = draw(img, ANALYSIS_MAX_SIDE);
    const [photo, thumbnail, barcode] = await Promise.all([
      toJpeg(canvas, 0.85),
      toJpeg(draw(img, THUMBNAIL_MAX_SIDE), 0.78).catch(() => null),
      withTimeout(detectRetailBarcode(canvas), BARCODE_TIMEOUT_MS, null),
    ]);
    return { photo, thumbnail, barcode };
  } finally {
    img.close();
  }
}

/** Warm up the barcode decoder while the user is still framing the shot. */
export function preloadPhotoTools(): void {
  void detectRetailBarcode(document.createElement("canvas"));
}
