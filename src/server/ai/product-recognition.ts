import "server-only";
import { searchProducts } from "../services/search-service";
import type {
  ImageRecognitionInput,
  ImageRecognitionProvider,
  ProductMatch,
  ProductRecognitionService,
} from "./types";

/**
 * Phase 2 skeleton: combines any ImageRecognitionProvider with our own
 * fuzzy catalogue search. Not registered yet (see registry.ts) because no
 * image provider exists, but the matching logic is ready.
 */
export class CatalogueProductRecognition implements ProductRecognitionService {
  constructor(private readonly vision: ImageRecognitionProvider) {}

  async identify(input: ImageRecognitionInput): Promise<ProductMatch[]> {
    const { candidates } = await this.vision.recognize(input);
    const matches = new Map<number, ProductMatch>();

    for (const candidate of candidates) {
      const query = [candidate.product, candidate.variant, candidate.size].filter(Boolean).join(" ");
      const { results } = await searchProducts(query, 5);
      const top = results[0]?.score ?? 1;
      for (const r of results) {
        const score = candidate.confidence * (r.score / top);
        const prev = matches.get(r.product.id);
        if (!prev || prev.score < score) matches.set(r.product.id, { product: r.product, score, candidate });
      }
    }

    return [...matches.values()].sort((a, b) => b.score - a.score).slice(0, 10);
  }
}
