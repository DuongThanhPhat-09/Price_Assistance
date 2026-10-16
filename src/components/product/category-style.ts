import {
  Cable,
  Droplets,
  Fan,
  Lightbulb,
  Package,
  Plug,
  ShieldCheck,
  ToggleRight,
  Wrench,
  Cylinder,
  type LucideIcon,
} from "lucide-react";
import { normalizeText } from "@/lib/text";

interface CategoryStyle {
  icon: LucideIcon;
  /** Tailwind classes for a tinted tile. */
  tile: string;
}

// Matched against the accent-free, lowercase category name.
const RULES: { test: RegExp; style: CategoryStyle }[] = [
  // Order matters: "Phụ kiện ống nước" must hit fittings before pipes.
  { test: /\b(phu kien|fitting)\b/, style: { icon: Wrench, tile: "bg-slate-200 text-slate-800" } },
  { test: /\b(ong|pipe)\b/, style: { icon: Cylinder, tile: "bg-sky-100 text-sky-800" } },
  { test: /\b(van|voi|valve|faucet|tap)\b/, style: { icon: Droplets, tile: "bg-cyan-100 text-cyan-800" } },
  { test: /\b(day|wire|cable)\b/, style: { icon: Cable, tile: "bg-orange-100 text-orange-800" } },
  { test: /\b(den|led|bong|light|lamp)\b/, style: { icon: Lightbulb, tile: "bg-yellow-100 text-yellow-800" } },
  { test: /\b(o cam|socket|outlet|plug)\b/, style: { icon: Plug, tile: "bg-indigo-100 text-indigo-800" } },
  { test: /\b(cong tac|switch)\b/, style: { icon: ToggleRight, tile: "bg-violet-100 text-violet-800" } },
  { test: /\b(cb|aptomat|breaker|bao ve)\b/, style: { icon: ShieldCheck, tile: "bg-rose-100 text-rose-800" } },
  { test: /\b(gia dung|quat|appliance|fan)\b/, style: { icon: Fan, tile: "bg-emerald-100 text-emerald-800" } },
  { test: /\b(dung cu|tool)\b/, style: { icon: Wrench, tile: "bg-stone-200 text-stone-800" } },
];

const FALLBACK: CategoryStyle = { icon: Package, tile: "bg-slate-100 text-slate-700" };

export function categoryStyle(category: string): CategoryStyle {
  const n = normalizeText(category);
  return RULES.find((r) => r.test.test(n))?.style ?? FALLBACK;
}
