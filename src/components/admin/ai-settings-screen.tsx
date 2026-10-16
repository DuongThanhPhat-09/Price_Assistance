"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleX, ExternalLink, FlaskConical, KeyRound, LoaderCircle, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import type { AISettingsDTO, AITestResult, VisionProviderId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";
import { RecognitionLogs } from "./recognition-logs";

const PROVIDERS: { id: VisionProviderId; label: string; env: string; keyUrl: string }[] = [
  { id: "openai", label: "OpenAI", env: "OPENAI_API_KEY", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "gemini", label: "Gemini", env: "GEMINI_API_KEY", keyUrl: "https://aistudio.google.com/apikey" },
];
const LABEL = { openai: "OpenAI", gemini: "Gemini" } as const;

type PerProvider<T> = Record<VisionProviderId, T>;

/** Shop-wide Smart Recognition settings + recognition logs. */
export function AISettingsScreen() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AISettingsDTO | null>(null);
  const [provider, setProvider] = useState<VisionProviderId>("openai");
  const [keys, setKeys] = useState<PerProvider<string>>({ openai: "", gemini: "" });
  const [removeKey, setRemoveKey] = useState<PerProvider<boolean>>({ openai: false, gemini: false });
  const [models, setModels] = useState<PerProvider<string>>({ openai: "", gemini: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<AITestResult | null>(null);
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
  };

  useEffect(() => {
    api.aiSettings().then(apply).catch(() => setLoadError(true));
  }, []);

  const savedModel = (id: VisionProviderId) =>
    settings && settings.providers[id].model !== settings.providers[id].defaultModel ? settings.providers[id].model : "";
  const dirty =
    !!settings &&
    (provider !== settings.provider ||
      PROVIDERS.some((p) => keys[p.id].trim() || removeKey[p.id] || models[p.id].trim() !== savedModel(p.id)));

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
        }),
      );
      setTest(null);
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
    setTest(null);
    try {
      setTest(await api.testAi(provider));
    } catch (e) {
      setTest({ ok: false, provider, code: "error", message: (e as Error).message || t("common.error") });
    } finally {
      setTesting(false);
    }
  };

  const current = settings?.providers[provider];
  const meta = PROVIDERS.find((p) => p.id === provider)!;
  const active = settings?.providers[settings.provider];

  return (
    <>
      <PageHeader title={t("aiSettings.title")} backHref="/admin" />
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
              <div className="grid grid-cols-2 gap-3">
                {PROVIDERS.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    aria-pressed={provider === p.id}
                    onClick={() => {
                      setProvider(p.id);
                      setTest(null);
                    }}
                    className={cn(provider === p.id && "border-primary bg-accent ring-2 ring-primary")}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
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
                spellCheck={false}
                autoCapitalize="none"
                placeholder={current.defaultModel}
                value={models[provider]}
                onChange={(e) => setModels((m) => ({ ...m, [provider]: e.target.value }))}
                className="font-mono"
              />
              <p className="text-base text-muted-foreground">{t("aiSettings.modelHint", { model: current.defaultModel })}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="lg" onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Save aria-hidden />}
                {t("common.save")}
              </Button>
              <Button size="lg" variant="outline" onClick={() => void runTest()} disabled={testing || saving}>
                {testing ? <LoaderCircle className="animate-spin" aria-hidden /> : <FlaskConical aria-hidden />}
                {testing ? t("aiSettings.testing") : t("aiSettings.test", { provider: meta.label })}
              </Button>
            </div>

            {test && (
              <p
                role="status"
                className={cn(
                  "flex gap-3 break-words rounded-2xl p-4 text-lg font-semibold",
                  test.ok ? "bg-emerald-50 text-success" : "bg-destructive/10 text-destructive",
                )}
              >
                {test.ok ? (
                  <CircleCheck className="mt-0.5 size-7 shrink-0" aria-hidden />
                ) : (
                  <CircleX className="mt-0.5 size-7 shrink-0" aria-hidden />
                )}
                <span className="min-w-0">
                  {test.ok
                    ? t("aiSettings.testOk", {
                        provider: LABEL[test.provider],
                        model: test.model,
                        seconds: (test.durationMs / 1000).toFixed(1),
                      })
                    : t("aiSettings.testFailed", { provider: LABEL[test.provider], message: test.message })}
                </span>
              </p>
            )}

            {!settings.hasSettingsSecret && PROVIDERS.some((p) => settings.providers[p.id].keySource === "settings") && (
              <p className="text-base text-muted-foreground">{t("aiSettings.secretTip")}</p>
            )}

            <div className="border-t-2 border-border pt-8">
              <RecognitionLogs />
            </div>
          </>
        )}
      </main>
    </>
  );
}
