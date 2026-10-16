"use client";

import { useRef } from "react";
import { Camera, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";

/**
 * Two giant buttons. "Take Photo" opens the phone's own camera app
 * (`capture="environment"`), which focuses and exposes far better than a
 * web preview — important for reading small print on packaging.
 */
export function PhotoPicker({ onPhoto }: { onPhoto: (file: File) => void }) {
  const { t } = useI18n();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same photo again
    if (file) onPhoto(file);
  };

  return (
    <div className="grid gap-4">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={onChange} />
      <input ref={galleryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={onChange} />
      <Button
        size="xl"
        className="h-auto min-h-32 flex-col gap-2 whitespace-normal bg-action-detect py-5 text-3xl text-white hover:bg-action-detect/90 [&_svg]:size-14"
        onClick={() => cameraRef.current?.click()}
      >
        <Camera aria-hidden />
        {t("detect.takePhoto")}
      </Button>
      <Button size="lg" variant="outline" className="h-auto min-h-16 whitespace-normal py-3" onClick={() => galleryRef.current?.click()}>
        <Images aria-hidden />
        {t("detect.choosePhoto")}
      </Button>
    </div>
  );
}
