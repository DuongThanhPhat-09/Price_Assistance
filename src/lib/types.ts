/**
 * Shapes shared by API routes and UI. Dates travel as ISO strings and
 * money as integer minor units (see lib/money.ts).
 */

export type SearchType = "text" | "voice" | "barcode" | "image";

export interface ProductDTO {
  id: number;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
  shelfLocation: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResultDTO {
  product: ProductDTO;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResultDTO[];
  /** Product id to open immediately when the match is unambiguous. */
  confidentMatchId: number | null;
}

export interface ProductListResponse {
  items: ProductDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecentSearchDTO {
  id: number;
  keyword: string;
  searchType: SearchType;
  createdAt: string;
  product: Pick<ProductDTO, "id" | "name" | "price" | "category" | "imageUrl"> | null;
}

export interface ImportResult {
  created: number;
  updated: number;
  failed: { row: number; error: string }[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}
