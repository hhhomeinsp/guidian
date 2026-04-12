"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import type { Lesson } from "@/lib/api/schema";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatSeconds } from "@/lib/utils";

export interface LessonPageProps {
  lesson: Lesson;
  moduleTitle?: string;
  progressPct?: number; // 0..100 across the course
  onPrev?: () => void;
  onNext?: () => void;
  onTick?: (secondsSpent: number) => void;
  children: React.ReactNode; // adaptive content slot (rendered by adaptive renderer)
}

/**
 * Master lesson wrapper. Owns the seat-time timer, the course progress bar,
 * and navigation affordances. The adaptive renderer lives in `children` so
 * variant switching can happen via React state with no reload (per the
 * non-negotiable in the project prompt).
 */
export function LessonPage({
  lesson,
  moduleTitle,
  progressPct = 0,
  onPrev,
  onNext,
  onTick,
  children,
}: LessonPageProps) {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        onTick?.(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [onTick]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <Progress value={progressPct} aria-label="Course progress" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{moduleTitle}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {formatSeconds(seconds)} /{" "}
            {lesson.clock_minutes * 60 ? formatSeconds(lesson.clock_minutes * 60) : "—"}
          </span>
        </div>
      </div>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{lesson.title}</h1>
        {lesson.objectives.length > 0 && (
          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold">Learning objectives</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
              {lesson.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <div className="min-h-[200px]">{children}</div>

      <nav className="flex items-center justify-between pt-6">
        <Button variant="outline" onClick={onPrev} disabled={!onPrev}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        <Button onClick={onNext} disabled={!onNext}>
          Next <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}
