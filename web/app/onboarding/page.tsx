"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useLearnerProfile, useMe, useSubmitVark } from "@/lib/api/hooks";
import { useLearnerStore } from "@/lib/store/learner";
import type { LearningStyle } from "@/lib/api/schema";
import { VARK_QUESTIONS } from "@/lib/vark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();
  const me = useMe();
  const profile = useLearnerProfile();
  const submit = useSubmitVark();
  const hydrate = useLearnerStore((s) => s.hydrate);

  const [answers, setAnswers] = React.useState<Record<string, LearningStyle>>({});
  const [index, setIndex] = React.useState(0);

  if (me.isLoading) return <Shell>Loading…</Shell>;
  if (me.error) {
    return (
      <Shell>
        <p className="text-steel">Please sign in to continue.</p>
      </Shell>
    );
  }

  const total = VARK_QUESTIONS.length;
  const question = VARK_QUESTIONS[index];
  const selected = answers[question.id];
  const progressPct = Math.round(((index + (selected ? 1 : 0)) / total) * 100);
  const isLast = index === total - 1;
  const complete = Object.keys(answers).length === total;

  const onSelect = (style: LearningStyle) => {
    setAnswers((a) => ({ ...a, [question.id]: style }));
  };

  const onNext = async () => {
    if (!selected) return;
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    const result = await submit.mutateAsync({
      answers: VARK_QUESTIONS.map((q) => ({ question_id: q.id, style: answers[q.id]! })),
    });
    hydrate({ preferredStyle: result.preferred_style, styleVector: result.style_vector });
    router.push("/courses");
  };

  const existingScores = profile.data?.vark_scores ?? {};
  const alreadyCompleted = Object.keys(existingScores).length > 0;

  return (
    <Shell>
      <div className="w-full max-w-2xl rounded-xl border border-cloud bg-white shadow-card">
        {/* Card header */}
        <div className="border-b border-cloud px-8 pt-8 pb-6">
          <h1 className="font-display text-xl font-semibold text-navy">
            Learning style assessment
          </h1>
          <p className="mt-1 font-body text-sm text-steel">
            {alreadyCompleted
              ? "You can retake this to refresh your profile at any time."
              : "A short inventory to personalize how lessons are rendered for you. About 90 seconds."}
          </p>
          {/* Amber progress bar */}
          <div className="mt-4 h-1.5 w-full rounded-full bg-fog overflow-hidden">
            <div
              className="h-full rounded-full bg-amber transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div>
            <p className="font-body text-xs font-medium uppercase tracking-[0.15em] text-steel">
              Question {index + 1} of {total}
            </p>
            <h2 className="mt-2 font-display text-lg font-semibold text-navy">{question.prompt}</h2>
          </div>

          <div className="grid gap-2">
            {question.options.map((opt) => (
              <button
                key={opt.style + opt.label}
                type="button"
                onClick={() => onSelect(opt.style)}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left font-body text-sm transition-colors",
                  selected === opt.style
                    ? "border-navy bg-navy text-white"
                    : "border-cloud bg-fog text-slate hover:border-navy/40 hover:bg-cloud",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              Back
            </Button>
            <Button onClick={onNext} disabled={!selected || submit.isPending}>
              {submit.isPending
                ? "Saving…"
                : isLast
                  ? complete
                    ? "Finish"
                    : "Finish"
                  : "Continue →"}
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="container flex min-h-[70vh] items-center justify-center py-12">
      {children}
    </main>
  );
}
