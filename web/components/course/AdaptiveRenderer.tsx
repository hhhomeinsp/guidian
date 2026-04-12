"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Headphones, BookOpen, Hand } from "lucide-react";
import type { LearningStyle, Lesson } from "@/lib/api/schema";
import { pickVariant } from "@/lib/adaptive";
import { useLearnerStore } from "@/lib/store/learner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./AudioPlayer";
import { Callout } from "./Callout";
import { Checklist } from "./Checklist";
import { ContentBlock } from "./ContentBlock";
import { Diagram } from "./Diagram";

/**
 * The adaptive renderer. Given a lesson, picks and renders ONE variant based
 * on the learner's preferred style, with all other variants available via a
 * one-click switcher.
 *
 * CRITICAL: Variant switching is a React state transition. No page reload,
 * no route change — per the non-negotiables in the project prompt.
 */
export interface AdaptiveRendererProps {
  lesson: Lesson;
  onVariantChange?: (variant: LearningStyle) => void;
  onBehavioralSignal?: (signal: { variant: LearningStyle; event: "switch" | "dwell" }) => void;
}

const VARIANT_META: Record<
  LearningStyle,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  visual: { icon: Eye, label: "Visual" },
  auditory: { icon: Headphones, label: "Auditory" },
  read: { icon: BookOpen, label: "Read" },
  kinesthetic: { icon: Hand, label: "Interactive" },
};

export function AdaptiveRenderer({ lesson, onVariantChange, onBehavioralSignal }: AdaptiveRendererProps) {
  const preferred = useLearnerStore((s) => s.preferredStyle);
  const recordVariant = useLearnerStore((s) => s.recordVariant);

  const [variant, setVariant] = React.useState<LearningStyle>(() => pickVariant(lesson, preferred));

  // Re-pick when lesson changes
  React.useEffect(() => {
    const next = pickVariant(lesson, preferred);
    setVariant(next);
    recordVariant(lesson.id, next);
    onVariantChange?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const supported = lesson.style_tags.length ? lesson.style_tags : (["read"] as LearningStyle[]);

  const switchVariant = (next: LearningStyle) => {
    if (next === variant) return;
    setVariant(next);
    recordVariant(lesson.id, next);
    onVariantChange?.(next);
    onBehavioralSignal?.({ variant: next, event: "switch" });
  };

  return (
    <div className="space-y-6">
      <VariantSwitcher
        supported={supported}
        current={variant}
        onChange={switchVariant}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={variant}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          <VariantBody lesson={lesson} variant={variant} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function VariantSwitcher({
  supported,
  current,
  onChange,
}: {
  supported: LearningStyle[];
  current: LearningStyle;
  onChange: (v: LearningStyle) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
      <span className="mx-2 text-xs font-medium text-muted-foreground">Format:</span>
      {(Object.keys(VARIANT_META) as LearningStyle[]).map((style) => {
        const Icon = VARIANT_META[style].icon;
        const disabled = !supported.includes(style);
        return (
          <Button
            key={style}
            type="button"
            size="sm"
            variant={current === style ? "default" : "outline"}
            disabled={disabled}
            onClick={() => onChange(style)}
            className={cn(disabled && "opacity-40")}
          >
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {VARIANT_META[style].label}
          </Button>
        );
      })}
    </div>
  );
}

function VariantBody({ lesson, variant }: { lesson: Lesson; variant: LearningStyle }) {
  switch (variant) {
    case "visual":
      return (
        <div className="space-y-4">
          {lesson.diagrams.length > 0 ? (
            lesson.diagrams.map((d) => <Diagram key={d.id} mermaid={d.mermaid} id={d.id} />)
          ) : (
            <Callout variant="note">
              No diagrams were generated for this lesson. Showing text instead.
            </Callout>
          )}
          <ContentBlock markdown={lesson.mdx_content} />
        </div>
      );
    case "auditory":
      return (
        <div className="space-y-4">
          <AudioPlayer src={lesson.audio_url ?? null} title={lesson.title} />
          <details className="rounded-md border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">Transcript</summary>
            <div className="mt-3">
              <ContentBlock markdown={lesson.mdx_content} />
            </div>
          </details>
        </div>
      );
    case "kinesthetic":
      return (
        <div className="space-y-4">
          <Checklist
            items={lesson.objectives.map((o, i) => ({ id: `obj-${i}`, label: o }))}
          />
          <ContentBlock markdown={lesson.mdx_content} />
        </div>
      );
    case "read":
    default:
      return <ContentBlock markdown={lesson.mdx_content} />;
  }
}
