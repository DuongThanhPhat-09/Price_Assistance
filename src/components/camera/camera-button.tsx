"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setPendingPhoto } from "@/lib/pending-photo";
import { preloadPhotoTools } from "@/lib/photo";

/**
 * A hidden file input plus a function that opens it. With `camera` the
 * phone's own camera app opens (`capture="environment"`): it focuses and
 * exposes far better than a web preview, which matters for small print.
 * `open` must run inside a tap handler — browsers block it otherwise.
 */
export function usePhotoInput(onPhoto: (file: File) => void, { camera = true }: { camera?: boolean } = {}) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      capture={camera ? "environment" : undefined}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow picking the same photo again
        if (file) onPhoto(file);
      }}
    />
  );
  return { input, open: () => ref.current?.click() };
}

/**
 * "Take a photo of a product": one tap opens the camera, and the photo
 * goes straight to the lookup screen. `replace` keeps Back going to the
 * screen before this one (used on the product screen).
 */
export function CameraLookupButton({
  replace = false,
  className,
  children,
}: {
  replace?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { input, open } = usePhotoInput((file) => {
    setPendingPhoto(file);
    if (replace) router.replace("/lookup");
    else router.push("/lookup");
  });

  // Warm up the barcode reader and the lookup screen while the user aims.
  useEffect(() => {
    preloadPhotoTools();
    router.prefetch("/lookup");
  }, [router]);

  return (
    <>
      {input}
      <button type="button" onClick={open} className={className}>
        {children}
      </button>
    </>
  );
}
