import { NextResponse, type NextRequest } from "next/server";
import { readJson, withErrorHandling } from "@/server/http";
import { getVisionProvider } from "@/server/ai/vision/factory";
import { solidColorPng } from "@/server/ai/vision/test-image";
import { VisionProviderError } from "@/server/ai/vision/types";
import { clientKey, createRateLimiter } from "@/server/rate-limit";
import type { AITestResult, VisionProviderId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/**
 * POST /api/ai/settings/test { provider? } — sends a small red test image
 * to the provider and checks a structured answer comes back. Always 200;
 * the body says whether it worked and, if not, why.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = (await readJson(req)) as { provider?: unknown } | undefined;
  const provider: VisionProviderId = body?.provider === "gemini" ? "gemini" : "openai";
  if (!limiter.take(clientKey(req))) {
    return NextResponse.json<AITestResult>({ ok: false, provider, code: "rate_limit", message: "Too many tests. Wait a minute." });
  }

  const started = Date.now();
  try {
    const vision = await getVisionProvider(provider);
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
      timeoutMs: 30_000,
    });
    if (typeof (res.output as { colour?: unknown })?.colour !== "string") {
      throw new VisionProviderError("invalid_response", "The answer did not match the expected format", provider);
    }
    return NextResponse.json<AITestResult>({ ok: true, provider, model: res.model, durationMs: Date.now() - started });
  } catch (e) {
    if (!(e instanceof VisionProviderError)) throw e;
    return NextResponse.json<AITestResult>({ ok: false, provider, code: e.code, message: e.message });
  }
});
