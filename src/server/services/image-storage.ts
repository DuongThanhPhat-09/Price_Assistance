import "server-only";
import { prisma } from "../db";

/**
 * Where uploaded photos live. The default keeps them in Postgres (the
 * phone uploads a ~30–80 KB thumbnail), which works on Vercel with no
 * extra service. To move to S3 / Vercel Blob / R2, implement ImageStore
 * and swap `imageStore` below — callers only see URLs.
 */
export interface ImageStore {
  /** Saves the image and returns the URL to show it. */
  save(data: Uint8Array, mimeType: string): Promise<string>;
}

export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_STORED_IMAGE_BYTES = 1024 * 1024;

const URL_PREFIX = "/api/images/";

class DatabaseImageStore implements ImageStore {
  async save(data: Uint8Array, mimeType: string): Promise<string> {
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error(`Unsupported image type ${mimeType}`);
    if (data.byteLength > MAX_STORED_IMAGE_BYTES) throw new Error("Image too large to store");
    const row = await prisma.storedImage.create({
      data: { data: Uint8Array.from(data), mimeType, size: data.byteLength },
      select: { id: true },
    });
    return URL_PREFIX + row.id;
  }
}

export const imageStore: ImageStore = new DatabaseImageStore();

export async function readStoredImage(id: string): Promise<{ data: Uint8Array; mimeType: string } | null> {
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return null;
  return prisma.storedImage.findUnique({ where: { id }, select: { data: true, mimeType: true } });
}
