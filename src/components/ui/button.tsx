import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// shadcn/ui Button, enlarged: smallest size is 56px tall (well above the
// 44px accessibility minimum) because many users have less precise taps.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-xl font-semibold transition-[color,background-color,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border-2 border-input bg-card text-foreground hover:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-muted",
        link: "text-primary underline underline-offset-4 hover:no-underline",
      },
      size: {
        default: "h-14 px-6 text-lg [&_svg]:size-6",
        lg: "h-16 px-8 text-xl [&_svg]:size-7",
        xl: "h-20 px-8 text-2xl [&_svg]:size-8",
        icon: "size-14 [&_svg]:size-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
