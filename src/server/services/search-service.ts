import "server-only";
import type { Product } from "@prisma/client";
import { prisma } from "../db";
import { buildIndex, fuzzySearch, pickConfidentMatch, type IndexedDoc } from "@/lib/search/fuzzy";
import type { SearchResponse } from "@/lib/types";
import { toProductDTO } from "../mappers";

/**
 * In-memory search index.
 *
 * A small shop has hundreds to a few thousand products, so scoring all of
 * them in memory takes a few milliseconds — far faster than any SQL LIKE
 * query, and it gives us accent-insensitive fuzzy matching for free.
 * The index is rebuilt after any write and at most every INDEX_TTL_MS.
 */
const INDEX_TTL_MS = 60_000;

const state = globalThis as unknown as {
  __paIndex?: { docs: IndexedDoc<Product>[]; builtAt: number } | null;
  __paIndexPending?: Promise<IndexedDoc<Product>[]> | null;
};

export function invalidateSearchIndex() {
  state.__paIndex = null;
}

async function getIndex(): Promise<IndexedDoc<Product>[]> {
  const cached = state.__paIndex;
  if (cached && Date.now() - cached.builtAt < INDEX_TTL_MS) return cached.docs;
  if (state.__paIndexPending) return state.__paIndexPending;

  state.__paIndexPending = (async () => {
    try {
      const products = await prisma.product.findMany();
      const docs = buildIndex(products, (p) => ({
        name: p.name,
        category: p.category,
        barcode: p.barcode,
        description: p.description,
        shelfLocation: p.shelfLocation,
      }));
      state.__paIndex = { docs, builtAt: Date.now() };
      return docs;
    } finally {
      state.__paIndexPending = null;
    }
  })();
  return state.__paIndexPending;
}

export async function searchProducts(query: string, limit = 20): Promise<SearchResponse> {
  const q = query.trim();
  if (!q) return { query: q, results: [], confidentMatchId: null };

  const index = await getIndex();
  const scored = fuzzySearch(index, q, limit);
  const confident = pickConfidentMatch(scored);

  return {
    query: q,
    results: scored.map((r) => ({ product: toProductDTO(r.item), score: Math.round(r.score * 100) / 100 })),
    confidentMatchId: confident?.id ?? null,
  };
}
