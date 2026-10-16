import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandling } from "@/server/http";
import { listRecognitions } from "@/server/services/recognition-service";

export const dynamic = "force-dynamic";

/** GET /api/ai/recognitions?limit=20&before=<id> → newest first (recognition logs). */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  return NextResponse.json(
    await listRecognitions({
      limit: Number(sp.get("limit")) || 20,
      before: Number(sp.get("before")) || undefined,
    }),
  );
});
