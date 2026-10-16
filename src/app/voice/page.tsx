import type { Metadata } from "next";
import { VoiceScreen } from "@/components/voice/voice-screen";

export const metadata: Metadata = { title: "Voice search" };

export default function VoicePage() {
  return <VoiceScreen />;
}
