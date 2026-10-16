"use client";

import { CsvImport } from "@/components/admin/csv-import";
import { PageHeader } from "@/components/layout/page-header";
import { useI18n } from "@/i18n/i18n-provider";

export default function ImportPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("import.title")} backHref="/admin" />
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-6">
        <CsvImport />
      </main>
    </>
  );
}
