import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiVisionProvider } from "@/server/ai/vision/providers/gemini";
import { OpenAIVisionProvider } from "@/server/ai/vision/providers/openai";
import { VisionProviderError, type StructuredVisionRequest } from "@/server/ai/vision/types";

const request: StructuredVisionRequest = {
  task: "product_recognition",
  instructions: "system rules",
  prompt: "identify",
  images: [{ data: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" }],
  schema: { type: "object", additionalProperties: false, properties: { ok: { type: "boolean" } }, required: ["ok"] },
};

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof VisionProviderError) return e.code;
    throw e;
  }
  throw new Error("expected an error");
}

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI adapter", () => {
  it("sends the image as a data URL with a strict JSON schema", async () => {
    const fetch = mockFetch(200, { model: "gpt-4o-2024-08-06", choices: [{ message: { content: '{"ok":true}' } }] });
    const res = await new OpenAIVisionProvider("sk-test", "gpt-4o").generateStructured(request);

    expect(res).toMatchObject({ output: { ok: true }, model: "gpt-4o-2024-08-06" });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body.response_format.json_schema).toMatchObject({ name: "product_recognition", strict: true });
    expect(body.messages[0]).toEqual({ role: "system", content: "system rules" });
    expect(body.messages[1].content[1].image_url.url).toBe("data:image/jpeg;base64,AQID");
  });

  it("maps errors to codes", async () => {
    mockFetch(401, { error: { message: "Incorrect API key", code: "invalid_api_key" } });
    expect(await codeOf(new OpenAIVisionProvider("bad").generateStructured(request))).toBe("auth");
    mockFetch(429, { error: { message: "You exceeded your quota", code: "insufficient_quota" } });
    expect(await codeOf(new OpenAIVisionProvider("k").generateStructured(request))).toBe("quota");
    mockFetch(429, { error: { message: "Rate limit" } });
    expect(await codeOf(new OpenAIVisionProvider("k").generateStructured(request))).toBe("rate_limit");
    mockFetch(404, { error: { message: "no such model", code: "model_not_found" } });
    expect(await codeOf(new OpenAIVisionProvider("k", "gpt-x").generateStructured(request))).toBe("model");
    mockFetch(200, { choices: [{ message: { content: null, refusal: "I can't help" } }] });
    expect(await codeOf(new OpenAIVisionProvider("k").generateStructured(request))).toBe("refused");
  });
});

describe("Gemini adapter", () => {
  it("sends inline image data and a Gemini response schema", async () => {
    const fetch = mockFetch(200, {
      modelVersion: "gemini-3.8-flash",
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: '```json\n{"ok":true}\n```' }] } }],
    });
    const res = await new GeminiVisionProvider("g-key").generateStructured(request);

    expect(res.output).toEqual({ ok: true }); // tolerates ```json fences
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("g-key");
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "AQID" } });
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", responseSchema: { type: "OBJECT" } });
  });

  it("maps errors and blocked answers to codes", async () => {
    mockFetch(400, {
      error: { message: "API key not valid.", status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] },
    });
    expect(await codeOf(new GeminiVisionProvider("bad").generateStructured(request))).toBe("auth");
    mockFetch(429, { error: { message: "Quota exceeded for requests per minute", status: "RESOURCE_EXHAUSTED" } });
    expect(await codeOf(new GeminiVisionProvider("k").generateStructured(request))).toBe("rate_limit");
    mockFetch(200, { promptFeedback: { blockReason: "SAFETY" } });
    expect(await codeOf(new GeminiVisionProvider("k").generateStructured(request))).toBe("refused");
    mockFetch(200, { candidates: [{ content: { parts: [{ text: "not json" }] } }] });
    expect(await codeOf(new GeminiVisionProvider("k").generateStructured(request))).toBe("invalid_response");
  });
});

describe("network failures", () => {
  it("reports an unreachable service as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(await codeOf(new OpenAIVisionProvider("k").generateStructured(request))).toBe("unavailable");
  });
});
