"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Large on/off switch (accessible role="switch"). */
function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-slot="switch"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-10 w-[4.5rem] shrink-0 items-center rounded-full border-2 transition-colors",
        checked ? "border-success bg-success" : "border-input bg-secondary",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-block size-8 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[2.1rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export { Switch };
