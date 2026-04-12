"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  id: string;
  label: string;
  required?: boolean;
}

export interface ChecklistProps {
  items: ChecklistItem[];
  value?: Record<string, boolean>;
  onChange?: (value: Record<string, boolean>) => void;
  onComplete?: () => void;
}

export function Checklist({ items, value: controlled, onChange, onComplete }: ChecklistProps) {
  const [internal, setInternal] = React.useState<Record<string, boolean>>({});
  const value = controlled ?? internal;

  const toggle = (id: string) => {
    const next = { ...value, [id]: !value[id] };
    if (!controlled) setInternal(next);
    onChange?.(next);
    const allRequiredDone = items.filter((i) => i.required !== false).every((i) => next[i.id]);
    if (allRequiredDone) onComplete?.();
  };

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const checked = !!value[item.id];
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border border-border p-3 text-left text-sm transition-colors hover:bg-accent",
                checked && "border-primary/50 bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
                aria-hidden
              >
                {checked && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className={cn("flex-1", checked && "line-through text-muted-foreground")}>
                {item.label}
              </span>
              {item.required === false && (
                <span className="text-xs text-muted-foreground">optional</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
