"use client";

import { PageHeader } from "@/components/layout/page-header";
import type { ProductDTO } from "@/lib/types";
import { useI18n } from "@/i18n/i18n-provider";
import { ProductForm } from "./product-form";

export function AdminFormPage({ product, initialBarcode }: { product?: ProductDTO; initialBarcode?: string }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={product ? t("admin.editTitle") : t("admin.newTitle")} />
      <main className="mx-auto max-w-3xl px-4 pt-6">
        <ProductForm product={product} initialBarcode={initialBarcode} />
      </main>
    </>
  );
}
