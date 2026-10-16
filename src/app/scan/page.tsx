import type { Metadata } from "next";
import { ScanScreen } from "@/components/scan/scan-screen";

export const metadata: Metadata = { title: "Scan barcode" };

export default function ScanPage() {
  return <ScanScreen />;
}
