import * as React from "react";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProgressCheckStatus = "pending" | "in_progress" | "complete";

export interface ProgressCheckProps {
  label: string;
  status: ProgressCheckStatus;
  description?: string;
  ceuHours?: number;
}

/**
 * Compliance milestone marker — displayed on the learner dashboard and at the
 * end of each module to indicate contribution to CEU hours.
 */
export function ProgressCheck({ label, status, description, ceuHours }: ProgressCheckProps) {
  const Icon = status === "complete" ? CheckCircle2 : status === "in_progress" ? Clock : Circle;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-border p-3",
        status === "complete" && "bg-emerald-500/5",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          status === "complete"
            ? "text-emerald-600"
            : status === "in_progress"
              ? "text-amber-500"
              : "text-muted-foreground",
        )}
      />
      <div className="flex-1">
        <p className="font-medium leading-tight">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {ceuHours !== undefined && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {ceuHours} CEU
        </span>
      )}
    </div>
  );
}
