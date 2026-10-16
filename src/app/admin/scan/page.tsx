import type { Metadata } from "next";
import { AdminScanScreen } from "@/components/admin/admin-scan-screen";

export const metadata: Metadata = { title: "Barcode scanner · Manage products" };

export default function AdminScanPage() {
  return <AdminScanScreen />;
}
