import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { toProductDTO } from "../mappers";
import { recognizeProduct } from "../ai/tasks/product-recognition";
import { getVisionProvider } from "../ai/vision/factory";
import { VisionProviderError, type VisionImage } from "../ai/vision/types";
import { imageStore } from "./image-storage";
import { createProduct, getProductByBarcode, listCategories } from "./product-service";
import { invalidateSearchIndex, searchProducts } from "./search-service";
import { isValidGs1 } from "@/lib/barcode";
import type { Locale } from "@/lib/config";
import { LOW_CONFIDENCE_THRESHOLD, rankProductMatches } from "@/lib/recognition/matching";
import type {
  ProductDTO,
  ProductMatchDTO,
  RecognitionLogDTO,
  RecognitionResponse,
  RecognitionStatus,
  RecognizedProductDTO,
  VisionAttemptDTO,
  VisionProviderId,
} from "@/lib/types";
import type { ProductInput } from "@/lib/validation";

/**
 * Smart Product Recognition workflow:
 *   photo → AI (any provider) → match against the catalogue → history row
 *   → owner reviews → save as new product, or link to an existing one.
 * Nothing is ever saved as a product without the owner tapping Save.
 */

export type RecognitionErrorCode = "not_found" | "already_saved" | "needs_review" | "not_recognized" | "product_not_found";

export class RecognitionError extends Error {
  constructor(
    public readonly code: RecognitionErrorCode,
    message: string,
    public readonly productId?: number | null,
  ) {
    super(message);
    this.name = "RecognitionError";
  }
}

export async function findProductMatches(r: RecognizedProductDTO): Promise<ProductMatchDTO[]> {
  const queries = [...new Set([[r.brand, r.model].filter(Boolean).join(" "), r.model ?? "", r.name])].filter(
    (q) => q.trim().length >= 2,
  );
  const [byBarcode, ...searches] = await Promise.all([
    r.barcode ? getProductByBarcode(r.barcode) : null,
    ...queries.map((q) => searchProducts(q, 8)),
  ]);
  const candidates = [...(byBarcode ? [byBarcode] : []), ...searches.flatMap((s) => s.results.map((x) => x.product))];
  return rankProductMatches({ name: r.name, brand: r.brand, model: r.model, barcode: r.barcode }, candidates);
}

export async function recognizeProductPhoto(input: {
  image: VisionImage;
  thumbnail: VisionImage | null;
  locale: Locale;
  /** Barcode the phone decoded from the same photo (ZXing — checksum-verified). */
  barcode: string | null;
  signal?: AbortSignal;
}): Promise<RecognitionResponse> {
  const provider = await getVisionProvider();
  const started = Date.now();

  const [categories, imageUrl] = await Promise.all([
    listCategories(),
    input.thumbnail
      ? imageStore.save(input.thumbnail.data, input.thumbnail.mimeType).catch((e) => {
          console.warn("[recognition] could not store thumbnail", e);
          return null;
        })
      : null,
  ]);

  let recognized: Awaited<ReturnType<typeof recognizeProduct>>;
  try {
    recognized = await recognizeProduct(provider, input.image, { locale: input.locale, categories }, input.signal);
  } catch (e) {
    if (e instanceof VisionProviderError) {
      const last = e.attempts?.at(-1);
      await prisma.productRecognitionHistory
        .create({
          data: {
            imageUrl,
            provider: last?.provider ?? provider.id,
            aiModel: last?.model ?? provider.model,
            status: "failed",
            error: `${e.code}: ${e.message}`.slice(0, 500),
            attempts: (e.attempts ?? []) as unknown as Prisma.InputJsonArray,
            durationMs: Date.now() - started,
          },
        })
        .catch(() => undefined);
    }
    throw e;
  }

  const result = recognized.result;
  const phoneBarcode = input.barcode?.replace(/\D/g, "") ?? "";
  if (isValidGs1(phoneBarcode)) result.barcode = phoneBarcode;

  const matches = await findProductMatches(result);
  const durationMs = Date.now() - started;
  const row = await prisma.productRecognitionHistory.create({
    data: {
      imageUrl,
      recognizedName: result.name || null,
      confidence: result.confidence,
      provider: recognized.provider,
      aiModel: recognized.model,
      status: "recognized",
      result: result as unknown as Prisma.InputJsonObject,
      attempts: recognized.attempts as unknown as Prisma.InputJsonArray,
      durationMs,
    },
    select: { id: true },
  });

  return {
    recognitionId: row.id,
    imageUrl,
    provider: recognized.provider,
    model: recognized.model,
    result,
    matches,
    lowConfidence: result.confidence < LOW_CONFIDENCE_THRESHOLD,
    durationMs,
  };
}

async function getRecognition(id: number) {
  const rec = await prisma.productRecognitionHistory.findUnique({ where: { id } });
  if (!rec) throw new RecognitionError("not_found", "Recognition not found");
  if (rec.status === "failed") throw new RecognitionError("not_recognized", "This photo was not recognised");
  if (rec.status === "created" || rec.status === "saving") {
    throw new RecognitionError("already_saved", "This photo was already saved as a product", rec.productId);
  }
  return rec;
}

/** Creates a new product from a reviewed recognition. */
export async function saveRecognizedProduct(
  id: number,
  input: ProductInput & { estimatedPrice?: number | null; reviewed: boolean },
): Promise<ProductDTO> {
  const { estimatedPrice, reviewed, ...product } = input;
  const rec = await getRecognition(id);
  if ((rec.confidence ?? 0) < LOW_CONFIDENCE_THRESHOLD && !reviewed) {
    throw new RecognitionError("needs_review", "Low-confidence result: confirm you checked the details before saving");
  }

  // Claim the row first so a double tap can't create two products.
  const claimed = await prisma.productRecognitionHistory.updateMany({
    where: { id, status: { in: ["recognized", "linked"] } },
    data: { status: "saving" },
  });
  if (claimed.count === 0) throw new RecognitionError("already_saved", "This photo was already saved as a product");

  const result = rec.result as unknown as RecognizedProductDTO | null;
  try {
    const created = await createProduct(product, {
      aiConfidence: rec.confidence,
      aiEstimatedPrice: estimatedPrice === undefined ? (result?.estimatedPrice ?? null) : estimatedPrice,
      recognizedText: result?.visibleText.join("\n") || null,
      recognitionProvider: rec.provider,
    });
    await prisma.productRecognitionHistory.update({
      where: { id },
      data: { status: "created", productId: created.id },
    });
    return created;
  } catch (e) {
    await prisma.productRecognitionHistory
      .update({ where: { id }, data: { status: rec.status } })
      .catch(() => undefined);
    throw e;
  }
}

/**
 * The owner picked an existing product instead of creating a duplicate.
 * Records the link and, if that product has no picture yet, uses this photo.
 */
export async function linkRecognitionToProduct(id: number, productId: number): Promise<ProductDTO> {
  const rec = await getRecognition(id);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new RecognitionError("product_not_found", "Product not found");

  const addImage = !product.imageUrl && !!rec.imageUrl;
  const [, updated] = await prisma.$transaction([
    prisma.productRecognitionHistory.update({ where: { id }, data: { status: "linked", productId } }),
    addImage
      ? prisma.product.update({ where: { id: productId }, data: { imageUrl: rec.imageUrl } })
      : prisma.product.findUniqueOrThrow({ where: { id: productId } }),
  ]);
  if (addImage) invalidateSearchIndex();
  return toProductDTO(updated);
}

export async function listRecognitions(opts: { limit?: number; before?: number } = {}): Promise<RecognitionLogDTO[]> {
  const rows = await prisma.productRecognitionHistory.findMany({
    where: opts.before ? { id: { lt: opts.before } } : undefined,
    orderBy: { id: "desc" },
    take: Math.min(100, Math.max(1, opts.limit ?? 20)),
    include: { product: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    imageUrl: r.imageUrl,
    recognizedName: r.recognizedName,
    confidence: r.confidence,
    provider: r.provider as VisionProviderId,
    aiModel: r.aiModel,
    status: r.status as RecognitionStatus,
    error: r.error,
    durationMs: r.durationMs,
    attempts: Array.isArray(r.attempts) ? (r.attempts as unknown as VisionAttemptDTO[]) : null,
    createdAt: r.createdAt.toISOString(),
    product: r.product,
  }));
}
