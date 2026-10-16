import { NextResponse, type NextRequest } from "next/server";
import { jsonError, withErrorHandling } from "@/server/http";
import { aiErrorResponse } from "@/server/ai/http-errors";
import { getSingleVisionProvider } from "@/server/ai/vision/factory";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/settings/models?provider=gemini → { models: string[] }
 * Models the saved/env key can use for photos, best first. Listing models
 * is free at both providers.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const provider = req.nextUrl.searchParams.get("provider");
  if (provider !== "openai" && provider !== "gemini") return jsonError(400, 'provider must be "openai" or "gemini"');
  try {
    const vision = await getSingleVisionProvider(provider);
    return NextResponse.json({ models: (await vision.listModels?.(req.signal)) ?? [] });
  } catch (e) {
    const res = aiErrorResponse(e);
    if (res) return res;
    throw e;
  }
});
