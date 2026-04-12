"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useLearnerProfile, useMe, useSubmitVark } from "@/lib/api/hooks";
import { useLearnerStore } from "@/lib/store/learner";
import type { LearningStyle } from "@/lib/api/schema";
import { VARK_QUESTIONS } from "@/lib/vark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
        <p className="text-muted-foreground">Please sign in to continue.</p>
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
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Learning style assessment</CardTitle>
          <p className="text-sm text-muted-foreground">
            {alreadyCompleted
              ? "You can retake this to refresh your profile at any time."
              : "A short inventory to personalize how lessons are rendered for you. About 90 seconds."}
          </p>
          <Progress value={progressPct} className="mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Question {index + 1} of {total}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{question.prompt}</h2>
          </div>
          <div className="grid gap-2">
            {question.options.map((opt) => (
              <button
                key={opt.style + opt.label}
                type="button"
                onClick={() => onSelect(opt.style)}
                className={cn(
                  "rounded-md border border-border p-3 text-left text-sm transition-colors hover:bg-accent",
                  selected === opt.style && "border-primary bg-primary/10",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
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
                  : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
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
