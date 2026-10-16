import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, withErrorHandling } from "@/server/http";
import { getAISettings, updateAISettings } from "@/server/services/ai-settings-service";
import { aiSettingsInputSchema, formatZodError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/ai/settings → AISettingsDTO (keys are masked, never returned). */
export const GET = withErrorHandling(async () => NextResponse.json(await getAISettings()));

/**
 * PUT /api/ai/settings { provider, openaiModel, geminiModel, openaiApiKey?, geminiApiKey? }
 * Omit a key to keep it; send "" to remove the saved key.
 */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const parsed = aiSettingsInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, formatZodError(parsed.error));
  return NextResponse.json(await updateAISettings(parsed.data));
});
