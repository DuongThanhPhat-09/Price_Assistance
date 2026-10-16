"use client";

import { create } from "zustand";
import type { SearchResultDTO } from "@/lib/types";

/**
 * Keeps the last typed search in memory so that pressing "Back" from a
 * product returns to the same results instead of an empty box.
 */
interface SearchState {
  query: string;
  results: SearchResultDTO[];
  resultsFor: string;
  setQuery: (q: string) => void;
  setResults: (q: string, results: SearchResultDTO[]) => void;
  reset: () => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  query: "",
  results: [],
  resultsFor: "",
  setQuery: (query) => set({ query }),
  setResults: (resultsFor, results) => set({ resultsFor, results }),
  reset: () => set({ query: "", results: [], resultsFor: "" }),
}));
