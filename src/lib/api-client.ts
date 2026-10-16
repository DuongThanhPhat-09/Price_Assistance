import type {
  AISettingsDTO,
  AITestResponse,
  ImportResult,
  ProductDTO,
  ProductListResponse,
  RecentSearchDTO,
  RecognitionLogDTO,
  RecognitionResponse,
  SearchResponse,
  SearchType,
  VisionProviderId,
} from "./types";
import type { AISettingsPayload, ProductInput, ProductInputPayload } from "./validation";

/** Thin typed wrapper around our own API routes (browser side). */

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Machine-readable reason from `details.code`, e.g. "not_configured". */
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    let message = res.statusText;
    let details: Record<string, unknown> | undefined;
    try {
      const body = (await res.json()) as { error?: string; details?: Record<string, unknown> };
      message = body.error ?? message;
      details = body.details;
    } catch {
      /* not JSON */
    }
    throw new ApiRequestError(message, res.status, typeof details?.code === "string" ? details.code : undefined, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  search: (q: string, opts: { limit?: number; signal?: AbortSignal } = {}) =>
    request<SearchResponse>(
      `/api/products?q=${encodeURIComponent(q)}&limit=${opts.limit ?? 20}`,
      { signal: opts.signal },
    ),

  /** Returns null when no product has this barcode. */
  byBarcode: async (code: string): Promise<ProductDTO | null> => {
    try {
      return await request<ProductDTO>(`/api/products/barcode/${encodeURIComponent(code)}`);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) return null;
      throw e;
    }
  },

  list: (page = 1, pageSize = 50) =>
    request<ProductListResponse>(`/api/products?page=${page}&pageSize=${pageSize}`),

  get: (id: number) => request<ProductDTO>(`/api/products/${id}`),
  create: (input: ProductInput) => request<ProductDTO>("/api/products", { method: "POST", ...json(input) }),
  update: (id: number, input: ProductInput) =>
    request<ProductDTO>(`/api/products/${id}`, { method: "PUT", ...json(input) }),
  remove: (id: number) => request<void>(`/api/products/${id}`, { method: "DELETE" }),
  categories: () => request<string[]>("/api/categories"),

  importCsv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<ImportResult>("/api/products/import", { method: "POST", body: form });
  },

  recent: (limit = 8) => request<RecentSearchDTO[]>(`/api/search-history?limit=${limit}`),
  clearHistory: () => request<{ deleted: number }>("/api/search-history", { method: "DELETE" }),

  /**
   * Fire-and-forget. `keepalive` lets the request finish even though we
   * navigate to the product page immediately afterwards.
   */
  recordSearch: (keyword: string, searchType: SearchType, productId?: number | null) => {
    void fetch("/api/search-history", {
      method: "POST",
      keepalive: true,
      ...json({ keyword: keyword.slice(0, 200), searchType, productId: productId ?? null }),
    }).catch(() => undefined);
  },

  /* Smart Product Recognition */

  recognize: (photo: Blob, opts: { thumbnail?: Blob | null; barcode?: string | null; signal?: AbortSignal } = {}) => {
    const form = new FormData();
    form.append("image", photo, "photo.jpg");
    if (opts.thumbnail) form.append("thumbnail", opts.thumbnail, "thumbnail.jpg");
    if (opts.barcode) form.append("barcode", opts.barcode);
    return request<RecognitionResponse>("/api/ai/recognize", { method: "POST", body: form, signal: opts.signal });
  },
  saveRecognized: (
    recognitionId: number,
    input: ProductInputPayload & { estimatedPrice: number | null; reviewed: boolean },
  ) => request<ProductDTO>(`/api/ai/recognitions/${recognitionId}/save`, { method: "POST", ...json(input) }),
  linkRecognition: (recognitionId: number, productId: number) =>
    request<ProductDTO>(`/api/ai/recognitions/${recognitionId}/link`, { method: "POST", ...json({ productId }) }),
  recognitions: (opts: { limit?: number; before?: number } = {}) =>
    request<RecognitionLogDTO[]>(`/api/ai/recognitions?limit=${opts.limit ?? 20}${opts.before ? `&before=${opts.before}` : ""}`),
  aiSettings: () => request<AISettingsDTO>("/api/ai/settings"),
  saveAiSettings: (input: AISettingsPayload) => request<AISettingsDTO>("/api/ai/settings", { method: "PUT", ...json(input) }),
  /** Tests every model of the chain (main + fallbacks) at once. */
  testAi: () => request<AITestResponse>("/api/ai/settings/test", { method: "POST" }),
  aiModels: (provider: VisionProviderId) =>
    request<{ models: string[] }>(`/api/ai/settings/models?provider=${provider}`),

  login: (pin: string) => request<{ ok: boolean }>("/api/admin/login", { method: "POST", ...json({ pin }) }),
  logout: () => request<void>("/api/admin/login", { method: "DELETE" }),
};
