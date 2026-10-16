import type { Metadata } from "next";
import { DetectProductScreen } from "@/components/recognition/detect-product-screen";
import { cleanBarcode } from "@/lib/barcode";

export const metadata: Metadata = { title: "Detect product" };

export default async function DetectProductPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string; from?: string }>;
}) {
  const { barcode, from } = await searchParams;
  const code = typeof barcode === "string" ? cleanBarcode(barcode).slice(0, 64) : "";
  return <DetectProductScreen initialBarcode={code || undefined} fromScan={from === "scan"} />;
}
