import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandling } from "@/server/http";
import { getVisionChain } from "@/server/ai/vision/factory";
import { solidColorPng } from "@/server/ai/vision/test-image";
import { VisionProviderError, type VisionProvider } from "@/server/ai/vision/types";
import { clientKey, createRateLimiter } from "@/server/rate-limit";
import type { AITestResponse, AITestResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

async function testOne(vision: VisionProvider): Promise<AITestResult> {
  const started = Date.now();
  try {
    const res = await vision.generateStructured({
      task: "connection_test",
      instructions: "You check images. Answer with JSON only.",
      prompt: "What is the main colour of this image? Answer in one English word.",
      images: [{ data: solidColorPng(64, [220, 38, 38]), mimeType: "image/png" }],
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { colour: { type: "string" } },
        required: ["colour"],
      },
      timeoutMs: 40_000,
    });
    if (typeof (res.output as { colour?: unknown })?.colour !== "string") {
      throw new VisionProviderError("invalid_response", "The answer did not match the expected format", vision.id);
    }
    return { ok: true, provider: vision.id, model: res.model, durationMs: Date.now() - started };
  } catch (e) {
    if (!(e instanceof VisionProviderError)) throw e;
    return { ok: false, provider: vision.id, model: vision.model, code: e.code, message: e.message };
  }
}

/**
 * POST /api/ai/settings/test — sends a small red test image to every model
 * in the chain (main first, then fallbacks) at the same time, without
 * retries, so the owner sees exactly which ones work. Always 200.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!limiter.take(clientKey(req))) {
    return NextResponse.json({ error: "Too many tests. Wait a minute.", details: { code: "rate_limit" } }, { status: 429 });
  }
  const chain = await getVisionChain();
  return NextResponse.json<AITestResponse>({ results: await Promise.all(chain.map(testOne)) });
});
