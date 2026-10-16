import type { Metadata } from "next";
import { AdminFormPage } from "@/components/admin/admin-form-page";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ barcode?: string }> }) {
  const { barcode } = await searchParams;
  return <AdminFormPage initialBarcode={typeof barcode === "string" ? barcode : undefined} />;
}
