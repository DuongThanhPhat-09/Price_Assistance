"use client";

import { Download } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { CsvImport } from "@/components/admin/csv-import";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";

export default function ImportExportPage() {
  const { t } = useI18n();
  return (
    <AdminShell>
      <section aria-labelledby="import-title" className="space-y-4">
        <h2 id="import-title" className="text-2xl font-extrabold">
          {t("import.title")}
        </h2>
        <CsvImport />
      </section>

      <section aria-labelledby="export-title" className="mt-10 space-y-4 border-t-2 border-border pt-8">
        <h2 id="export-title" className="text-2xl font-extrabold">
          {t("export.title")}
        </h2>
        <p className="text-lg text-muted-foreground">{t("export.hint")}</p>
        <Button asChild size="lg" variant="outline" className="w-full">
          <a href="/api/products/export" download>
            <Download aria-hidden />
            {t("admin.export")}
          </a>
        </Button>
      </section>
    </AdminShell>
  );
}
