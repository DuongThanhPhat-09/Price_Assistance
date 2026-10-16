import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { decryptSecret, encryptSecret, hasSettingsSecret, maskSecret } from "../secret-box";
import { GEMINI_DEFAULT_MODEL } from "../ai/vision/providers/gemini";
import { OPENAI_DEFAULT_MODEL } from "../ai/vision/providers/openai";
import type { AISettingsDTO, ApiKeySource, VisionProviderId } from "@/lib/types";
import type { AISettingsInput } from "@/lib/validation";

/**
 * Smart Recognition settings: which AI provider to use, its model, its key,
 * and the fallback models tried when the main one fails.
 *
 * Precedence (highest first):
 *   API key   OPENAI_API_KEY / GEMINI_API_KEY env  →  key saved in Settings
 *   model     model saved in Settings  →  OPENAI_VISION_MODEL / GEMINI_VISION_MODEL env  →  default
 *   provider  provider saved in Settings  →  AI_VISION_PROVIDER env  →  first provider with a key
 *
 * Env keys win so a host-managed secret can't be overridden from the UI.
 * A fallback can carry its own key (e.g. another Google project); without
 * one it uses its provider's key.
 */

const SETTING_KEY = "ai.vision";
export const PROVIDERS: VisionProviderId[] = ["openai", "gemini"];
export const MAX_FALLBACKS = 3;

interface StoredFallback {
  id: string;
  provider: VisionProviderId;
  model: string;
  /** Encrypted with secret-box. */
  key?: string;
}

interface StoredSettings {
  provider?: VisionProviderId;
  models?: Partial<Record<VisionProviderId, string>>;
  /** Encrypted with secret-box. */
  keys?: Partial<Record<VisionProviderId, string>>;
  fallbacks?: StoredFallback[];
}

const DEFAULT_MODELS: Record<VisionProviderId, string> = {
  openai: OPENAI_DEFAULT_MODEL,
  gemini: GEMINI_DEFAULT_MODEL,
};

function envKey(provider: VisionProviderId): string | null {
  const v = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  return v?.trim() || null;
}

function envModel(provider: VisionProviderId): string | null {
  const v = provider === "openai" ? process.env.OPENAI_VISION_MODEL : process.env.GEMINI_VISION_MODEL;
  return v?.trim() || null;
}

function envProvider(): VisionProviderId | null {
  const v = process.env.AI_VISION_PROVIDER?.trim().toLowerCase();
  return v === "openai" || v === "gemini" ? v : null;
}

async function readStored(): Promise<StoredSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return {};
  try {
    return JSON.parse(row.value) as StoredSettings;
  } catch {
    return {};
  }
}

function keyFor(stored: StoredSettings, provider: VisionProviderId): { key: string | null; source: ApiKeySource } {
  const fromEnv = envKey(provider);
  if (fromEnv) return { key: fromEnv, source: "env" };
  const sealed = stored.keys?.[provider];
  const saved = sealed ? decryptSecret(sealed) : null;
  return saved ? { key: saved, source: "settings" } : { key: null, source: null };
}

function pickProvider(stored: StoredSettings): VisionProviderId {
  return (
    stored.provider ??
    envProvider() ??
    PROVIDERS.find((p) => keyFor(stored, p).key) ??
    "openai"
  );
}

function modelFor(stored: StoredSettings, provider: VisionProviderId): string {
  return stored.models?.[provider] || envModel(provider) || DEFAULT_MODELS[provider];
}

function fallbackKey(stored: StoredSettings, f: StoredFallback) {
  const own = f.key ? decryptSecret(f.key) : null;
  return own ? { key: own, source: "own" as const } : keyFor(stored, f.provider);
}

export interface VisionConfig {
  provider: VisionProviderId;
  apiKey: string;
  model: string;
}

/** Ready-to-use configuration for a provider (default: the selected one), or null without a key. */
export async function resolveVisionConfig(provider?: VisionProviderId): Promise<VisionConfig | null> {
  const stored = await readStored();
  const id = provider ?? pickProvider(stored);
  const { key } = keyFor(stored, id);
  return key ? { provider: id, apiKey: key, model: modelFor(stored, id) } : null;
}

/**
 * Main model first, then the fallbacks, in the order they are tried.
 * Entries without a usable key are skipped; duplicates are dropped.
 */
export async function resolveVisionChain(): Promise<VisionConfig[]> {
  const stored = await readStored();
  const main = pickProvider(stored);
  const candidates: (VisionConfig | null)[] = [
    (() => {
      const { key } = keyFor(stored, main);
      return key ? { provider: main, apiKey: key, model: modelFor(stored, main) } : null;
    })(),
    ...(stored.fallbacks ?? []).map((f) => {
      const { key } = fallbackKey(stored, f);
      return key && f.model ? { provider: f.provider, apiKey: key, model: f.model } : null;
    }),
  ];
  const seen = new Set<string>();
  return candidates.filter((c): c is VisionConfig => {
    if (!c) return false;
    const id = `${c.provider}|${c.model}|${c.apiKey}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function getAISettings(): Promise<AISettingsDTO> {
  const stored = await readStored();
  const provider = pickProvider(stored);
  const providers = Object.fromEntries(
    PROVIDERS.map((id) => {
      const { key, source } = keyFor(stored, id);
      const defaultModel = envModel(id) || DEFAULT_MODELS[id];
      return [
        id,
        { model: stored.models?.[id] || defaultModel, defaultModel, keySource: source, keyHint: key ? maskSecret(key) : null },
      ];
    }),
  ) as AISettingsDTO["providers"];

  const fallbacks = (stored.fallbacks ?? []).map((f) => {
    const { key, source } = fallbackKey(stored, f);
    return { id: f.id, provider: f.provider, model: f.model, keySource: source, keyHint: key ? maskSecret(key) : null };
  });

  return {
    provider,
    ready: !!providers[provider].keySource,
    providers,
    fallbacks,
    hasSettingsSecret: hasSettingsSecret(),
  };
}

export async function updateAISettings(input: AISettingsInput): Promise<AISettingsDTO> {
  const stored = await readStored();
  const next: StoredSettings = {
    provider: input.provider,
    models: { ...stored.models },
    keys: { ...stored.keys },
  };

  const changes: [VisionProviderId, string | null, string | null | undefined][] = [
    ["openai", input.openaiModel, input.openaiApiKey],
    ["gemini", input.geminiModel, input.geminiApiKey],
  ];
  for (const [id, model, key] of changes) {
    if (model) next.models![id] = model;
    else delete next.models![id];
    if (key === undefined) continue; // unchanged
    if (key) next.keys![id] = encryptSecret(key);
    else delete next.keys![id];
  }

  // Fallbacks are matched by id so a row keeps its own key when others are
  // added, removed or reordered.
  next.fallbacks = (input.fallbacks ?? []).slice(0, MAX_FALLBACKS).map((f) => {
    const existing = f.id ? stored.fallbacks?.find((x) => x.id === f.id) : undefined;
    const key = f.apiKey === undefined ? existing?.key : f.apiKey ? encryptSecret(f.apiKey) : undefined;
    return { id: existing?.id ?? randomUUID(), provider: f.provider, model: f.model, ...(key ? { key } : {}) };
  });

  const value = JSON.stringify(next);
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value },
    update: { value },
  });
  return getAISettings();
}
