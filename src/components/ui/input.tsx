import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-14 w-full min-w-0 rounded-xl border-2 border-input bg-card px-4 text-lg text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
