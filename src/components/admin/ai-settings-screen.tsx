"use client";

import { useEffect, useState } from "react";
import {
  CircleCheck,
  CircleX,
  ExternalLink,
  FlaskConical,
  KeyRound,
  ListRestart,
  LoaderCircle,
  Plus,
  Save,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import type { AISettingsDTO, AITestResult, ApiKeySource, VisionProviderId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";

const PROVIDERS: { id: VisionProviderId; label: string; env: string; keyUrl: string }[] = [
  { id: "openai", label: "OpenAI", env: "OPENAI_API_KEY", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini", label: "Gemini", env: "GEMINI_API_KEY", keyUrl: "https://aistudio.google.com/apikey" },
];
const LABEL = { openai: "OpenAI", gemini: "Gemini" } as const;
const MAX_FALLBACKS = 3;
const MAX_MODEL_CHIPS = 12;

type PerProvider<T> = Record<VisionProviderId, T>;

interface FallbackRow {
  /** React key; stable even for rows not saved yet. */
  rowKey: string;
  /** Saved row id (keeps its own key on save). */
  id?: string;
  provider: VisionProviderId;
  model: string;
  apiKey: string;
  removeKey: boolean;
  keySource: ApiKeySource;
  keyHint: string | null;
}

let rowSeq = 0;
const newRowKey = () => `row-${++rowSeq}`;

function rowsFrom(s: AISettingsDTO): FallbackRow[] {
  return s.fallbacks.map((f) => ({
    rowKey: newRowKey(),
    id: f.id,
    provider: f.provider,
    model: f.model,
    apiKey: "",
    removeKey: false,
    keySource: f.keySource,
    keyHint: f.keyHint,
  }));
}

/** Shop-wide Smart Recognition settings + recognition logs. */
export function AISettingsScreen() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AISettingsDTO | null>(null);
  const [provider, setProvider] = useState<VisionProviderId>("openai");
  const [keys, setKeys] = useState<PerProvider<string>>({ openai: "", gemini: "" });
  const [removeKey, setRemoveKey] = useState<PerProvider<boolean>>({ openai: false, gemini: false });
  const [models, setModels] = useState<PerProvider<string>>({ openai: "", gemini: "" });
  const [fallbacks, setFallbacks] = useState<FallbackRow[]>([]);
  const [modelLists, setModelLists] = useState<Partial<PerProvider<string[]>>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tests, setTests] = useState<AITestResult[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const apply = (s: AISettingsDTO) => {
    setSettings(s);
    setProvider(s.provider);
    setKeys({ openai: "", gemini: "" });
    setRemoveKey({ openai: false, gemini: false });
    setModels({
      openai: s.providers.openai.model === s.providers.openai.defaultModel ? "" : s.providers.openai.model,
      gemini: s.providers.gemini.model === s.providers.gemini.defaultModel ? "" : s.providers.gemini.model,
    });
    setFallbacks(rowsFrom(s));
  };

  useEffect(() => {
    api.aiSettings().then(apply).catch(() => setLoadError(true));
  }, []);

  const savedModel = (id: VisionProviderId) =>
    settings && settings.providers[id].model !== settings.providers[id].defaultModel ? settings.providers[id].model : "";
  const fallbacksChanged =
    !!settings &&
    (fallbacks.length !== settings.fallbacks.length ||
      fallbacks.some((r, i) => {
        const s = settings.fallbacks[i];
        return r.id !== s.id || r.provider !== s.provider || r.model.trim() !== s.model || !!r.apiKey.trim() || r.removeKey;
      }));
  const dirty =
    !!settings &&
    (provider !== settings.provider ||
      fallbacksChanged ||
      PROVIDERS.some((p) => keys[p.id].trim() || removeKey[p.id] || models[p.id].trim() !== savedModel(p.id)));

  const updateRow = (rowKey: string, patch: Partial<FallbackRow>) =>
    setFallbacks((rows) => rows.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const keyChange = (id: VisionProviderId) => (removeKey[id] ? "" : keys[id].trim() || undefined);
      apply(
        await api.saveAiSettings({
          provider,
          openaiModel: models.openai,
          geminiModel: models.gemini,
          openaiApiKey: keyChange("openai"),
          geminiApiKey: keyChange("gemini"),
          // Rows left without a model name are dropped rather than rejected.
          fallbacks: fallbacks
            .filter((r) => r.model.trim())
            .map((r) => ({
              id: r.id,
              provider: r.provider,
              model: r.model.trim(),
              apiKey: r.removeKey ? "" : r.apiKey.trim() || undefined,
            })),
        }),
      );
      setTests(null);
      toast.success(t("aiSettings.saved"));
      return true;
    } catch (e) {
      toast.error((e as Error).message || t("common.error"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (dirty && !(await save())) return;
    setTesting(true);
    setTests(null);
    try {
      setTests((await api.testAi()).results);
    } catch (e) {
      toast.error((e as Error).message || t("common.error"));
    } finally {
      setTesting(false);
    }
  };

  /** Lists models for every provider that has a key (listing is free). */
  const loadModels = async () => {
    if (!settings) return;
    const wanted = [...new Set([provider, ...fallbacks.map((f) => f.provider)])].filter(
      (p) => settings.providers[p].keySource,
    );
    setLoadingModels(true);
    try {
      const lists = await Promise.all(wanted.map(async (p) => [p, (await api.aiModels(p)).models] as const));
      setModelLists((prev) => ({ ...prev, ...Object.fromEntries(lists) }));
    } catch (e) {
      toast.error((e as Error).message || t("common.error"));
    } finally {
      setLoadingModels(false);
    }
  };

  const current = settings?.providers[provider];
  const meta = PROVIDERS.find((p) => p.id === provider)!;
  const active = settings?.providers[settings.provider];
  const list = modelLists[provider];

  return (
    <>
      <PageHeader title={t("aiSettings.title")} backHref="/admin/settings" />
      <main className="mx-auto max-w-3xl space-y-8 px-4 pb-12 pt-6">
        {loadError && (
          <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-lg font-medium text-destructive">
            {t("common.error")}
          </p>
        )}
        {!settings && !loadError && (
          <div className="flex justify-center py-10">
            <LoaderCircle className="size-10 animate-spin text-primary" aria-label={t("common.loading")} />
          </div>
        )}

        {settings && current && active && (
          <>
            <div
              role="status"
              className={cn(
                "flex items-start gap-3 rounded-2xl p-4 text-lg font-semibold ring-2",
                settings.ready ? "bg-emerald-50 ring-emerald-200" : "bg-amber-50 ring-amber-200",
              )}
            >
              {settings.ready ? (
                <CircleCheck className="mt-0.5 size-7 shrink-0 text-success" aria-hidden />
              ) : (
                <TriangleAlert className="mt-0.5 size-7 shrink-0 text-warning" aria-hidden />
              )}
              <span className="min-w-0 break-words">
                {settings.ready
                  ? t("aiSettings.ready", { provider: LABEL[settings.provider], model: active.model })
                  : t("aiSettings.notReady", { provider: LABEL[settings.provider] })}
              </span>
            </div>

            <p className="text-base text-muted-foreground">{t("aiSettings.intro")}</p>

            <div className="space-y-2">
              <p className="text-lg font-semibold">{t("aiSettings.provider")}</p>
              <ProviderToggle value={provider} onChange={(p) => { setProvider(p); setTests(null); }} />
            </div>

            <div className="space-y-3 rounded-2xl border-2 border-border bg-card p-4">
              <Label htmlFor="ai-key" className="flex items-center gap-2">
                <KeyRound className="size-6 text-primary" aria-hidden />
                {t("aiSettings.apiKey", { provider: meta.label })}
              </Label>
              <p className="break-words text-base text-muted-foreground">
                {current.keySource === "env"
                  ? t("aiSettings.keyFromEnv", { name: meta.env, hint: current.keyHint ?? "" })
                  : current.keySource === "settings"
                    ? t("aiSettings.keySaved", { hint: current.keyHint ?? "" })
                    : t("aiSettings.keyNone")}
              </p>
              {current.keySource !== "env" && (
                <>
                  <Input
                    id="ai-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t("aiSettings.keyPlaceholder")}
                    value={keys[provider]}
                    onChange={(e) => {
                      setKeys((k) => ({ ...k, [provider]: e.target.value }));
                      setRemoveKey((r) => ({ ...r, [provider]: false }));
                    }}
                    className="font-mono"
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="link" className="h-auto px-0 py-2">
                      <a href={meta.keyUrl} target="_blank" rel="noopener noreferrer">
                        {t("aiSettings.getKey")}
                        <ExternalLink className="size-5" aria-hidden />
                      </a>
                    </Button>
                    {current.keySource === "settings" && !removeKey[provider] && (
                      <Button
                        variant="outline"
                        className="ml-auto border-destructive/60 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setRemoveKey((r) => ({ ...r, [provider]: true }));
                          setKeys((k) => ({ ...k, [provider]: "" }));
                        }}
                      >
                        {t("aiSettings.removeKey")}
                      </Button>
                    )}
                  </div>
                  {removeKey[provider] && (
                    <p className="text-base font-semibold text-destructive">{t("aiSettings.keyWillBeRemoved")}</p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model">{t("aiSettings.model")}</Label>
              <Input
                id="ai-model"
                list={`models-${provider}`}
                spellCheck={false}
                autoCapitalize="none"
                placeholder={current.defaultModel}
                value={models[provider]}
                onChange={(e) => setModels((m) => ({ ...m, [provider]: e.target.value }))}
                className="font-mono"
              />
              <p className="text-base text-muted-foreground">{t("aiSettings.modelHint", { model: current.defaultModel })}</p>
              <Button
                variant="outline"
                className="h-auto min-h-12 whitespace-normal py-2 text-base"
                onClick={() => void loadModels()}
                disabled={loadingModels || !current.keySource}
              >
                {loadingModels ? <LoaderCircle className="animate-spin" aria-hidden /> : <ListRestart aria-hidden />}
                {loadingModels ? t("aiSettings.loadingModels") : t("aiSettings.loadModels")}
              </Button>
              {list && (
                <div className="space-y-2 pt-1">
                  <p className="text-base text-muted-foreground">
                    {list.length ? t("aiSettings.modelsHint") : t("aiSettings.modelsNone")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {list.slice(0, MAX_MODEL_CHIPS).map((m) => {
                      const selected = (models[provider].trim() || current.defaultModel) === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setModels((x) => ({ ...x, [provider]: m === current.defaultModel ? "" : m }))}
                          className={cn(
                            "min-h-12 rounded-full border-2 px-4 font-mono text-base",
                            selected ? "border-primary bg-accent font-bold" : "border-input bg-card",
                          )}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <section aria-labelledby="fallbacks-title" className="space-y-3">
              <h2 id="fallbacks-title" className="text-xl font-extrabold">
                {t("aiSettings.fallbacks")}
              </h2>
              <p className="text-base text-muted-foreground">{t("aiSettings.fallbacksHint")}</p>

              {fallbacks.map((row, i) => {
                const shared = settings.providers[row.provider];
                const ownKey = row.keySource === "own" && !row.removeKey;
                return (
                  <div key={row.rowKey} className="space-y-3 rounded-2xl border-2 border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-bold">{t("aiSettings.fallbackN", { n: i + 1 })}</p>
                      <Button
                        variant="ghost"
                        className="h-12 px-3 text-base text-destructive"
                        onClick={() => setFallbacks((rows) => rows.filter((r) => r.rowKey !== row.rowKey))}
                      >
                        <X aria-hidden />
                        {t("aiSettings.removeFallback")}
                      </Button>
                    </div>
                    <ProviderToggle value={row.provider} onChange={(p) => updateRow(row.rowKey, { provider: p })} small />
                    <Input
                      aria-label={`${t("aiSettings.fallbackN", { n: i + 1 })} — ${t("aiSettings.model")}`}
                      list={`models-${row.provider}`}
                      spellCheck={false}
                      autoCapitalize="none"
                      placeholder={row.provider === "gemini" ? "gemini-…-flash-lite" : "gpt-4o-mini"}
                      value={row.model}
                      onChange={(e) => updateRow(row.rowKey, { model: e.target.value })}
                      className="font-mono"
                    />
                    <p className="break-words text-base text-muted-foreground">
                      {ownKey
                        ? t("aiSettings.fallbackKeyOwn", { hint: row.keyHint ?? "" })
                        : shared.keySource
                          ? t("aiSettings.fallbackKeyShared", { provider: LABEL[row.provider], hint: shared.keyHint ?? "" })
                          : t("aiSettings.fallbackNoKey", { provider: LABEL[row.provider] })}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Input
                        type="password"
                        aria-label={`${t("aiSettings.fallbackN", { n: i + 1 })} — ${t("aiSettings.fallbackKeyPlaceholder")}`}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={t("aiSettings.fallbackKeyPlaceholder")}
                        value={row.apiKey}
                        onChange={(e) => updateRow(row.rowKey, { apiKey: e.target.value, removeKey: false })}
                        className="min-w-0 flex-1 basis-56"
                      />
                      {ownKey && (
                        <Button
                          variant="outline"
                          className="border-destructive/60 text-destructive hover:bg-destructive/10"
                          onClick={() => updateRow(row.rowKey, { removeKey: true, apiKey: "" })}
                        >
                          {t("aiSettings.removeOwnKey")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {fallbacks.length < MAX_FALLBACKS && (
                <Button
                  variant="outline"
                  className="h-auto min-h-14 w-full whitespace-normal border-dashed py-3"
                  onClick={() =>
                    setFallbacks((rows) => [
                      ...rows,
                      {
                        rowKey: newRowKey(),
                        provider,
                        model: "",
                        apiKey: "",
                        removeKey: false,
                        keySource: null,
                        keyHint: null,
                      },
                    ])
                  }
                >
                  <Plus aria-hidden />
                  {t("aiSettings.addFallback")}
                </Button>
              )}
            </section>

            {PROVIDERS.map((p) => (
              <datalist key={p.id} id={`models-${p.id}`}>
                {(modelLists[p.id] ?? []).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="lg" onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Save aria-hidden />}
                {t("common.save")}
              </Button>
              <Button size="lg" variant="outline" onClick={() => void runTest()} disabled={testing || saving}>
                {testing ? <LoaderCircle className="animate-spin" aria-hidden /> : <FlaskConical aria-hidden />}
                {testing ? t("aiSettings.testing") : t("aiSettings.test")}
              </Button>
            </div>

            {tests && (
              <ul role="status" className="space-y-2">
                {tests.length === 0 && (
                  <li className="rounded-2xl bg-amber-50 p-4 text-lg font-semibold">{t("aiSettings.testNone")}</li>
                )}
                {tests.map((r, i) => {
                  const label = i === 0 ? t("aiSettings.testMain") : t("aiSettings.fallbackN", { n: i });
                  return (
                    <li
                      key={`${i}-${r.model}`}
                      className={cn(
                        "flex gap-3 break-words rounded-2xl p-4 text-lg font-semibold",
                        r.ok ? "bg-emerald-50 text-success" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {r.ok ? (
                        <CircleCheck className="mt-0.5 size-7 shrink-0" aria-hidden />
                      ) : (
                        <CircleX className="mt-0.5 size-7 shrink-0" aria-hidden />
                      )}
                      <span className="min-w-0">
                        {r.ok
                          ? t("aiSettings.testOk", {
                              label,
                              provider: LABEL[r.provider],
                              model: r.model,
                              seconds: (r.durationMs / 1000).toFixed(1),
                            })
                          : t("aiSettings.testFailed", { label, provider: LABEL[r.provider], model: r.model, message: r.message })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {!settings.hasSettingsSecret &&
              (PROVIDERS.some((p) => settings.providers[p.id].keySource === "settings") ||
                settings.fallbacks.some((f) => f.keySource === "own")) && (
                <p className="text-base text-muted-foreground">{t("aiSettings.secretTip")}</p>
              )}
          </>
        )}
      </main>
    </>
  );
}

function ProviderToggle({
  value,
  onChange,
  small = false,
}: {
  value: VisionProviderId;
  onChange: (p: VisionProviderId) => void;
  small?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {PROVIDERS.map((p) => (
        <Button
          key={p.id}
          variant="outline"
          aria-pressed={value === p.id}
          onClick={() => onChange(p.id)}
          className={cn(small && "h-12 text-base", value === p.id && "border-primary bg-accent ring-2 ring-primary")}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
