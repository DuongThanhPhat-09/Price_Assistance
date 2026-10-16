"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useI18n } from "@/i18n/i18n-provider";

function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(pin);
      // Only allow redirects back into the admin area.
      router.replace(next && next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError((err as { status?: number }).status === 401 ? t("login.wrong") : (err as Error).message);
      setPin("");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-10 max-w-sm space-y-6 px-4 text-center">
      <Lock className="mx-auto size-16 text-primary" aria-hidden />
      <h2 className="text-2xl font-bold">{t("login.title")}</h2>
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        aria-label={t("login.title")}
        aria-invalid={!!error}
        className="h-20 text-center text-4xl tracking-[0.5em]"
      />
      {error && (
        <p role="alert" className="text-lg font-semibold text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="xl" className="w-full" disabled={!pin || busy}>
        {busy && <LoaderCircle className="animate-spin" aria-hidden />}
        {t("login.submit")}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("admin.title")} backHref="/" />
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
