"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { RecognitionLogs } from "@/components/admin/recognition-logs";

export default function RecognitionLogsPage() {
  return (
    <AdminShell>
      <RecognitionLogs />
    </AdminShell>
  );
}
