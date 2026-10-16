"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { categoryStyle } from "./category-style";

/**
 * Product photo with a friendly fallback: if there is no image (or it
 * fails to load) we show a large category icon instead of a broken image.
 */
export function ProductImage({
  src,
  alt,
  category,
  className,
  iconClassName,
}: {
  src: string | null | undefined;
  alt: string;
  category: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = categoryStyle(category);
  const Icon = style.icon;

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary shop-provided URLs
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("bg-white object-contain", className)}
      />
    );
  }

  return (
    <div role="img" aria-label={alt} className={cn("flex items-center justify-center", style.tile, className)}>
      <Icon className={cn("size-1/2", iconClassName)} strokeWidth={1.75} aria-hidden />
    </div>
  );
}
