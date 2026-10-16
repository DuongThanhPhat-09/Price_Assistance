"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useI18n } from "@/i18n/i18n-provider";

/** Delete with a plain-language confirmation — deleting is never one tap. */
export function DeleteProductButton({
  id,
  name,
  onDeleted,
}: {
  id: number;
  name: string;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await api.remove(id);
      toast.success(t("admin.deleted"));
      onDeleted();
    } catch (e) {
      toast.error((e as Error).message || t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="border-destructive/60 text-destructive hover:bg-destructive/10"
          aria-label={`${t("common.delete")} ${name}`}
        >
          <Trash2 aria-hidden />
          {t("common.delete")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.deleteTitle", { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("admin.deleteWarn")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={busy}>
            <Trash2 className="size-6" aria-hidden />
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
