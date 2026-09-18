import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const tones: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-blue-50 text-blue-800 ring-blue-200"
};

export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded px-2 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
