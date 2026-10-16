import type { Metadata } from "next";
import { SearchScreen } from "@/components/search/search-screen";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <SearchScreen initialQuery={typeof q === "string" ? q : undefined} />;
}
