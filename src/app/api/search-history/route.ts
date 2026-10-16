import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, withErrorHandling } from "@/server/http";
import { clearSearchHistory, getRecentSearches, recordSearch } from "@/server/services/history-service";
import { formatZodError, searchHistoryInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(30, Math.max(1, Number(sp.get("limit")) || 8));
  return NextResponse.json(await getRecentSearches(limit, { productsOnly: sp.get("products") === "1" }));
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const parsed = searchHistoryInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));
  await recordSearch(parsed.data);
  return new NextResponse(null, { status: 204 });
});

export const DELETE = withErrorHandling(async () => {
  const deleted = await clearSearchHistory();
  return NextResponse.json({ deleted });
});
