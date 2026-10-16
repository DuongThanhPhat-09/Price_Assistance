"use client";

import { useRef, useState } from "react";
import { CircleCheck, Download, FileSpreadsheet, LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { ImportResult } from "@/lib/types";
import { useI18n } from "@/i18n/i18n-provider";

export function CsvImport() {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setBusy(true);
    try {
      setResult(await api.importCsv(file));
    } catch (e) {
      toast.error((e as Error).message || t("common.error"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <ol className="space-y-4 text-lg">
        <li className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">1</span>
          <span>{t("import.step1")}</span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">2</span>
          <span>{t("import.step2")}</span>
        </li>
      </ol>

      <Button asChild variant="outline" size="lg" className="w-full">
        <a href="/sample-products.csv" download>
          <Download aria-hidden />
          {t("import.sample")}
        </a>
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        id="csv-file"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button size="xl" className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <FileSpreadsheet aria-hidden />}
        {busy ? t("import.uploading") : t("import.choose")}
      </Button>
      {fileName && <p className="text-center text-base text-muted-foreground">{fileName}</p>}

      <p className="text-base text-muted-foreground">{t("import.note")}</p>

      {result && (
        <section role="status" className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <CircleCheck className="size-8 text-success" aria-hidden />
            {t("import.done")}
          </h2>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 p-3">
              <dt className="text-base text-muted-foreground">{t("import.created")}</dt>
              <dd className="text-3xl font-black text-success">{result.created}</dd>
            </div>
            <div className="rounded-xl bg-blue-50 p-3">
              <dt className="text-base text-muted-foreground">{t("import.updated")}</dt>
              <dd className="text-3xl font-black text-primary">{result.updated}</dd>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <dt className="text-base text-muted-foreground">{t("import.failed")}</dt>
              <dd className="text-3xl font-black text-destructive">{result.failed.length}</dd>
            </div>
          </dl>
          {result.failed.length > 0 && (
            <ul className="mt-4 max-h-72 space-y-2 overflow-auto">
              {result.failed.map((f) => (
                <li key={`${f.row}-${f.error}`} className="flex gap-2 rounded-lg bg-red-50 p-3 text-base">
                  <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
                  <span>
                    <strong>
                      {t("import.row")} {f.row}:
                    </strong>{" "}
                    {f.error}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
