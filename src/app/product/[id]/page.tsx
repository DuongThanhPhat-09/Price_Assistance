import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetails } from "@/components/product/product-details";
import { parseId } from "@/server/http";
import { getProductById } from "@/server/services/product-service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  const product = id ? await getProductById(id) : null;
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const product = await getProductById(id);
  if (!product) notFound();
  const { q } = await searchParams;
  return <ProductDetails product={product} query={typeof q === "string" ? q : undefined} />;
}
