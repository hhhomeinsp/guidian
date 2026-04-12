import * as React from "react";
import { AlertTriangle, Info, Lightbulb, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalloutVariant = "tip" | "warning" | "important" | "note";

const variantMap: Record<
  CalloutVariant,
  { icon: React.ComponentType<{ className?: string }>; classes: string; label: string }
> = {
  tip: {
    icon: Lightbulb,
    classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    label: "Tip",
  },
  warning: {
    icon: AlertTriangle,
    classes: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    label: "Warning",
  },
  important: {
    icon: Info,
    classes: "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100",
    label: "Important",
  },
  note: {
    icon: StickyNote,
    classes: "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100",
    label: "Note",
  },
};

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CalloutVariant;
  title?: string;
}

export function Callout({
  variant = "note",
  title,
  className,
  children,
  ...rest
}: CalloutProps) {
  const v = variantMap[variant];
  const Icon = v.icon;
  return (
    <div
      role="note"
      className={cn("my-4 flex gap-3 rounded-md border p-4 text-sm", v.classes, className)}
      {...rest}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold">{title ?? v.label}</p>
        <div className="leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
}
