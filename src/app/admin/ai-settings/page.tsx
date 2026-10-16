import type { Metadata } from "next";
import { AISettingsScreen } from "@/components/admin/ai-settings-screen";

export const metadata: Metadata = { title: "Smart Recognition settings" };

export default function AISettingsPage() {
  return <AISettingsScreen />;
}
