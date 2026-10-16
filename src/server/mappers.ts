import type { Product } from "@prisma/client";
import type { ProductDTO, VisionProviderId } from "@/lib/types";

export function toProductDTO(p: Product): ProductDTO {
  return {
    id: p.id,
    barcode: p.barcode,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    costPrice: p.costPrice,
    stockQuantity: p.stockQuantity,
    shelfLocation: p.shelfLocation,
    imageUrl: p.imageUrl,
    brand: p.brand,
    model: p.model,
    variant: p.variant,
    aiConfidence: p.aiConfidence,
    aiEstimatedPrice: p.aiEstimatedPrice,
    recognizedText: p.recognizedText,
    recognitionProvider: p.recognitionProvider as VisionProviderId | null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
