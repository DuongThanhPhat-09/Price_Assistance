import type { Metadata } from "next";
import { AdminScreen } from "@/components/admin/admin-screen";

export const metadata: Metadata = { title: "Manage products" };

export default function AdminPage() {
  return <AdminScreen />;
}
