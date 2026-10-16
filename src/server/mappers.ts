import type { Product } from "@prisma/client";
import type { ProductDTO } from "@/lib/types";

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
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
