import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-28 w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
