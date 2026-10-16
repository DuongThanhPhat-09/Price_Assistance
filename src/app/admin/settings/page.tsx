"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { History, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";
import { useSettingsStore } from "@/store/settings-store";

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const { storeName, showCostPrice, setStoreName, setShowCostPrice } = useSettingsStore();
  const [name, setName] = useState(storeName);

  // Pick up the persisted value once the store has rehydrated.
  useEffect(() => setName(storeName), [storeName]);

  const clearHistory = async () => {
    try {
      await api.clearHistory();
      toast.success(t("settings.historyCleared"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const lock = async () => {
    await api.logout().catch(() => undefined);
    router.push("/");
  };

  return (
    <AdminShell>
      <div className="space-y-8">
        <p className="text-base text-muted-foreground">{t("settings.thisDevice")}</p>

        <div className="space-y-2">
          <Label htmlFor="store-name">{t("settings.storeName")}</Label>
          <Input
            id="store-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setStoreName(name)}
            onKeyDown={(e) => e.key === "Enter" && setStoreName(name)}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-border bg-card p-4">
          <div>
            <p id="show-cost-label" className="text-lg font-semibold">
              {t("settings.showCost")}
            </p>
            <p className="text-base text-muted-foreground">{t("settings.showCostHint")}</p>
          </div>
          <Switch aria-labelledby="show-cost-label" checked={showCostPrice} onCheckedChange={setShowCostPrice} />
        </div>

        <div className="space-y-2">
          <p className="text-lg font-semibold">{t("settings.language")}</p>
          <div className="grid grid-cols-2 gap-3">
            {(["vi", "en"] as const).map((l) => (
              <Button
                key={l}
                variant="outline"
                aria-pressed={locale === l}
                onClick={() => setLocale(l)}
                className={cn(locale === l && "border-primary bg-accent ring-2 ring-primary")}
              >
                {l === "vi" ? "Tiếng Việt" : "English"}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 border-t-2 border-border pt-8">
          <Button asChild variant="outline">
            <Link href="/admin/ai-settings">
              <Sparkles aria-hidden />
              {t("settings.aiSettings")}
            </Link>
          </Button>
          <Button variant="outline" onClick={clearHistory}>
            <History aria-hidden />
            {t("settings.clearHistory")}
          </Button>
          <Button variant="outline" onClick={lock}>
            <Lock aria-hidden />
            {t("settings.logout")}
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}
