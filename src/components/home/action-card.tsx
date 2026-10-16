import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One of the three giant home-screen buttons. */
export function ActionCard({
  href,
  icon: Icon,
  label,
  hint,
  className,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-32 items-center gap-5 rounded-3xl p-5 text-white shadow-lg transition-transform active:scale-[0.98] md:min-h-56 md:flex-col md:justify-center md:text-center",
        className,
      )}
    >
      <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-white/20 md:size-24">
        <Icon className="size-12 md:size-14" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[1.75rem] font-extrabold leading-tight">{label}</span>
        <span className="mt-1 text-lg font-medium text-white/90">{hint}</span>
      </span>
    </Link>
  );
}
