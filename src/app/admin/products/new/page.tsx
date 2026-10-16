import type { Metadata } from "next";
import { AdminFormPage } from "@/components/admin/admin-form-page";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string; from?: string }>;
}) {
  const { barcode, from } = await searchParams;
  const code = typeof barcode === "string" ? barcode : undefined;
  return <AdminFormPage initialBarcode={code} notice={from === "scan" && code ? "scan-new" : undefined} />;
}
