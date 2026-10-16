"use client";

import { Camera, Images } from "lucide-react";
import { usePhotoInput } from "@/components/camera/camera-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/i18n-provider";

/** Two giant buttons: the phone's camera, or a photo already taken. */
export function PhotoPicker({
  onPhoto,
  tone = "detect",
}: {
  onPhoto: (file: File) => void;
  /** "lookup" = customer camera (blue), "detect" = admin adding products (purple). */
  tone?: "lookup" | "detect";
}) {
  const { t } = useI18n();
  const camera = usePhotoInput(onPhoto);
  const gallery = usePhotoInput(onPhoto, { camera: false });

  return (
    <div className="grid gap-4">
      {camera.input}
      {gallery.input}
      <Button
        size="xl"
        className={cn(
          "h-auto min-h-32 flex-col gap-2 whitespace-normal py-5 text-3xl text-white [&_svg]:size-14",
          tone === "lookup" ? "bg-action-camera hover:bg-action-camera/90" : "bg-action-detect hover:bg-action-detect/90",
        )}
        onClick={camera.open}
      >
        <Camera aria-hidden />
        {t("detect.takePhoto")}
      </Button>
      <Button size="lg" variant="outline" className="h-auto min-h-16 whitespace-normal py-3" onClick={gallery.open}>
        <Images aria-hidden />
        {t("detect.choosePhoto")}
      </Button>
    </div>
  );
}
