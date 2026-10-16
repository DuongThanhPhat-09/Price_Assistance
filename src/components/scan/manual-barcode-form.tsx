"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/i18n-provider";

/**
 * "Or type the barcode number" — fallback for damaged labels, devices
 * without a camera, and USB barcode guns (which type digits + Enter).
 */
export function ManualBarcodeForm({ onSubmit, className }: { onSubmit: (code: string) => void; className?: string }) {
  const { t } = useI18n();
  const id = useId();
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value);
  };

  return (
    <form onSubmit={submit} className={className}>
      <label htmlFor={id} className="text-xl font-semibold">
        {t("scan.typeBarcode")}
      </label>
      <div className="mt-3 flex gap-3">
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="893…"
          className="h-16 min-w-0 flex-1 text-2xl tracking-wider"
        />
        <Button type="submit" size="lg" disabled={!value.trim()} className="shrink-0">
          {t("scan.find")}
        </Button>
      </div>
    </form>
  );
}
