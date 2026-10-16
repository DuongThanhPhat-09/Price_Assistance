import "server-only";
import { prisma } from "../db";
import type { RecentSearchDTO, SearchType } from "@/lib/types";

export async function recordSearch(input: {
  keyword: string;
  searchType: SearchType;
  productId?: number | null;
}): Promise<void> {
  // Ignore a product id that no longer exists rather than failing the request.
  const productId =
    input.productId && (await prisma.product.count({ where: { id: input.productId } })) > 0
      ? input.productId
      : null;
  await prisma.searchHistory.create({
    data: { keyword: input.keyword, searchType: input.searchType, productId },
  });
}

/**
 * Most recent searches, newest first, with duplicates collapsed so the
 * home screen never shows the same product twice.
 */
export async function getRecentSearches(limit = 8): Promise<RecentSearchDTO[]> {
  const rows = await prisma.searchHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: limit * 6,
    include: {
      product: { select: { id: true, name: true, price: true, category: true, imageUrl: true } },
    },
  });

  const seen = new Set<string>();
  const out: RecentSearchDTO[] = [];
  for (const r of rows) {
    const key = r.product ? `p:${r.product.id}` : `k:${r.keyword.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: r.id,
      keyword: r.keyword,
      searchType: r.searchType as SearchType,
      createdAt: r.createdAt.toISOString(),
      product: r.product,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function clearSearchHistory(): Promise<number> {
  const res = await prisma.searchHistory.deleteMany();
  return res.count;
}
