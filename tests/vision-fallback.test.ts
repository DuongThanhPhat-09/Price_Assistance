import { describe, expect, it, vi } from "vitest";
import { FallbackVisionProvider } from "@/server/ai/vision/fallback";
import { pickGeminiVisionModels } from "@/server/ai/vision/providers/gemini";
import { pickOpenAIVisionModels } from "@/server/ai/vision/providers/openai";
import {
  VisionProviderError,
  type StructuredVisionRequest,
  type VisionErrorCode,
  type VisionProvider,
} from "@/server/ai/vision/types";

const request: StructuredVisionRequest = {
  task: "t",
  instructions: "i",
  prompt: "p",
  images: [],
  schema: { type: "object", additionalProperties: false, properties: {}, required: [] },
};

/** A fake model that fails with the given codes in turn, then answers. */
function fakeModel(model: string, failures: VisionErrorCode[] = []): VisionProvider & { calls: number } {
  const queue = [...failures];
  const fake = {
    id: "gemini" as const,
    model,
    calls: 0,
    async generateStructured() {
      fake.calls++;
      const code = queue.shift();
      if (code) throw new VisionProviderError(code, `${model} ${code}`, "gemini");
      return { output: { from: model }, provider: "gemini" as const, model };
    },
  };
  return fake;
}

const noWait = { sleep: vi.fn(async () => undefined) };

describe("FallbackVisionProvider", () => {
  it("uses the main model when it works", async () => {
    const main = fakeModel("main");
    const backup = fakeModel("backup");
    const res = await new FallbackVisionProvider([main, backup], noWait).generateStructured(request);
    expect(res.output).toEqual({ from: "main" });
    expect(backup.calls).toBe(0);
    expect(res.attempts).toEqual([expect.objectContaining({ model: "main", ok: true })]);
  });

  it("retries an overloaded model once, then falls back", async () => {
    const main = fakeModel("main", ["unavailable", "unavailable"]);
    const backup = fakeModel("backup");
    const res = await new FallbackVisionProvider([main, backup], noWait).generateStructured(request);
    expect(res.output).toEqual({ from: "backup" });
    expect(main.calls).toBe(2);
    expect(res.attempts?.map((a) => [a.model, a.ok, a.code])).toEqual([
      ["main", false, "unavailable"],
      ["main", false, "unavailable"],
      ["backup", true, undefined],
    ]);
  });

  it("recovers on the retry without touching the fallback", async () => {
    const main = fakeModel("main", ["rate_limit"]);
    const backup = fakeModel("backup");
    const res = await new FallbackVisionProvider([main, backup], noWait).generateStructured(request);
    expect(res.output).toEqual({ from: "main" });
    expect(backup.calls).toBe(0);
  });

  it("skips a retired model or bad key straight away (no retry)", async () => {
    const retired = fakeModel("retired", ["model"]);
    const badKey = fakeModel("bad-key", ["auth"]);
    const backup = fakeModel("backup");
    const res = await new FallbackVisionProvider([retired, badKey, backup], noWait).generateStructured(request);
    expect(res.output).toEqual({ from: "backup" });
    expect([retired.calls, badKey.calls]).toEqual([1, 1]);
  });

  it("stops when the photo itself is refused", async () => {
    const main = fakeModel("main", ["refused"]);
    const backup = fakeModel("backup");
    await expect(new FallbackVisionProvider([main, backup], noWait).generateStructured(request)).rejects.toMatchObject({
      code: "refused",
    });
    expect(backup.calls).toBe(0);
  });

  it("reports the last error with every attempt when all fail", async () => {
    const main = fakeModel("main", ["unavailable", "unavailable"]);
    const backup = fakeModel("backup", ["model"]);
    const err = await new FallbackVisionProvider([main, backup], noWait).generateStructured(request).catch((e) => e);
    expect(err).toBeInstanceOf(VisionProviderError);
    expect(err.code).toBe("model");
    expect(err.attempts).toHaveLength(3);
  });

  it("waits longer with nothing to fall back to: two retries", async () => {
    const only = fakeModel("only", ["unavailable", "unavailable"]);
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined);
    const res = await new FallbackVisionProvider([only], { sleep }).generateStructured(request);
    expect(res.output).toEqual({ from: "only" });
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 3000]);
  });

  it("does not start another attempt when the time budget is used up", async () => {
    const slow: VisionProvider = {
      id: "gemini",
      model: "slow",
      async generateStructured() {
        await new Promise((r) => setTimeout(r, 30));
        throw new VisionProviderError("timeout", "slow", "gemini");
      },
    };
    const backup = fakeModel("backup");
    const err = await new FallbackVisionProvider([slow, backup], { ...noWait, budgetMs: 40, minAttemptMs: 20 })
      .generateStructured(request)
      .catch((e) => e);
    expect(err.code).toBe("timeout");
    expect(backup.calls).toBe(0);
  });

  it("caps each attempt's timeout so a hanging model leaves time for the next", async () => {
    const seen: (number | undefined)[] = [];
    const main: VisionProvider = {
      id: "gemini",
      model: "main",
      async generateStructured(req) {
        seen.push(req.timeoutMs);
        return { output: {}, provider: "gemini", model: "main" };
      },
    };
    await new FallbackVisionProvider([main], { attemptTimeoutMs: 30_000 }).generateStructured(request);
    expect(seen[0]).toBeLessThanOrEqual(30_000);
  });
});

describe("model lists", () => {
  it("keeps Gemini models that can read a photo and answer, Flash first", () => {
    const models = pickGeminiVisionModels([
      { name: "models/gemini-3.8-pro", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
      { name: "models/gemini-3.8-flash-lite", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-3.8-flash-image", supportedGenerationMethods: ["generateContent"] },
      { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
      { name: "models/gemini-3.8-flash-tts", supportedGenerationMethods: ["generateContent"] },
      { name: "models/imagen-4.0", supportedGenerationMethods: ["predict"] },
    ]);
    expect(models).toEqual(["gemini-3.8-flash-lite", "gemini-3.8-flash", "gemini-3.8-pro"]);
  });

  it("keeps OpenAI chat models only", () => {
    expect(
      pickOpenAIVisionModels(["gpt-4o", "gpt-4o-mini", "gpt-4o-audio-preview", "text-embedding-3-small", "dall-e-3", "whisper-1"]),
    ).toEqual(["gpt-4o-mini", "gpt-4o"]);
  });
});
