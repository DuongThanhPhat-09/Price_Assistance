import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminFormPage } from "@/components/admin/admin-form-page";
import { parseId } from "@/server/http";
import { getProductById } from "@/server/services/product-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const product = await getProductById(id);
  if (!product) notFound();
  const { from } = await searchParams;
  return <AdminFormPage product={product} notice={from === "scan" ? "scan-existing" : undefined} />;
}
