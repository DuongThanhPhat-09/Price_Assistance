import type { Metadata } from "next";
import { AdminScanScreen } from "@/components/admin/admin-scan-screen";

export const metadata: Metadata = { title: "Scan to add products" };

export default function AdminScanPage() {
  return <AdminScanScreen />;
}
