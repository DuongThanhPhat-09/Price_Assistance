import type { Metadata } from "next";
import { LookupScreen } from "@/components/lookup/lookup-screen";

export const metadata: Metadata = { title: "Take a photo" };

export default function LookupPage() {
  return <LookupScreen />;
}
