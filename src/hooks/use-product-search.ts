"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import type { SearchResultDTO } from "@/lib/types";

/**
 * Debounced, cancellable search-as-you-type. Older requests are aborted so
 * a slow response can never overwrite a newer one.
 */
export function useProductSearch(
  query: string,
  opts: { delayMs?: number; initial?: { for: string; results: SearchResultDTO[] } } = {},
) {
  const { delayMs = 120, initial } = opts;
  const [results, setResults] = useState<SearchResultDTO[]>(initial?.results ?? []);
  const [resultsFor, setResultsFor] = useState(initial?.for ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      controller.current?.abort();
      setResults([]);
      setResultsFor("");
      setLoading(false);
      setError(false);
      return;
    }
    if (q === resultsFor) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      api
        .search(q, { signal: ac.signal, limit: 30 })
        .then((res) => {
          setResults(res.results);
          setResultsFor(q);
          setError(false);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if ((e as Error).name === "AbortError") return;
          setError(true);
          setLoading(false);
        });
    }, delayMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resultsFor is an output, not a trigger
  }, [query, delayMs]);

  useEffect(() => () => controller.current?.abort(), []);

  return { results, resultsFor, loading, error };
}
