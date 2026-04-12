"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";
import {
  useCourse,
  useLesson,
  useLessonProgress,
  useQuizSummary,
  useSendSignals,
  useSubmitQuiz,
  useUpdateLessonProgress,
} from "@/lib/api/hooks";
import type { LearningStyle } from "@/lib/api/schema";
import { AdaptiveRenderer, LessonPage, Quiz } from "@/components/course";

export default function LessonPlayerPage({
  params,
}: {
  params: { courseId: string; lessonId: string };
}) {
  const { courseId, lessonId } = params;
  const router = useRouter();
  const course = useCourse(courseId);
  const lesson = useLesson(lessonId);
  useLessonProgress(lessonId); // prime the cache
  const updateProgress = useUpdateLessonProgress(lessonId);
  const sendSignals = useSendSignals();
  const submitQuiz = useSubmitQuiz(lessonId);
  const quizSummary = useQuizSummary(lessonId);

  // Build a flat lesson list to know prev/next within the course
  const flatLessons = useMemo(() => {
    const out: { id: string; moduleTitle: string; moduleIndex: number; lessonIndex: number }[] = [];
    (course.data?.modules ?? []).forEach((m, mi) =>
      m.lessons.forEach((l, li) =>
        out.push({ id: l.id, moduleTitle: m.title, moduleIndex: mi, lessonIndex: li }),
      ),
    );
    return out;
  }, [course.data]);

  const currentIdx = flatLessons.findIndex((l) => l.id === lessonId);
  const current = flatLessons[currentIdx];
  const prev = currentIdx > 0 ? flatLessons[currentIdx - 1] : null;
  const next = currentIdx < flatLessons.length - 1 ? flatLessons[currentIdx + 1] : null;
  const progressPct = flatLessons.length
    ? Math.round(((currentIdx + 1) / flatLessons.length) * 100)
    : 0;

  // Throttle seat-time updates to server: once every 15s
  const lastSentRef = useRef(0);
  const handleTick = useCallback(
    (seconds: number) => {
      if (seconds - lastSentRef.current >= 15) {
        lastSentRef.current = seconds;
        updateProgress.mutate({ seconds_spent: seconds });
      }
    },
    [updateProgress],
  );

  const handleVariantChange = useCallback(
    (variant: LearningStyle) => {
      updateProgress.mutate({ variant_served: variant });
    },
    [updateProgress],
  );

  const hasQuiz = !!lesson.data?.quiz?.questions?.length;
  const quizPassed = quizSummary.data?.passed ?? false;
  const canAdvance = !hasQuiz || quizPassed;

  const handleComplete = async () => {
    try {
      if (canAdvance) {
        await updateProgress.mutateAsync({ completed: true });
      }
    } catch {
      // The server may reject completion if the quiz gate fails; just navigate.
    }
    if (next) router.push(`/courses/${courseId}/lessons/${next.id}`);
    else router.push(`/courses/${courseId}`);
  };

  if (lesson.isLoading || course.isLoading) {
    return <main className="container py-12 text-muted-foreground">Loading lesson…</main>;
  }
  if (lesson.error || !lesson.data) {
    return <main className="container py-12 text-destructive">Failed to load lesson.</main>;
  }

  return (
    <LessonPage
      lesson={lesson.data}
      moduleTitle={current?.moduleTitle}
      progressPct={progressPct}
      onPrev={prev ? () => router.push(`/courses/${courseId}/lessons/${prev.id}`) : undefined}
      onNext={canAdvance ? handleComplete : undefined}
      onTick={handleTick}
    >
      <div className="space-y-8">
        <AdaptiveRenderer
          lesson={lesson.data}
          onVariantChange={handleVariantChange}
          onBehavioralSignal={(sig) =>
            sendSignals.mutate({
              signals: [{ lesson_id: lessonId, variant: sig.variant, event: sig.event }],
            })
          }
        />
        {lesson.data.quiz?.questions?.length ? (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Knowledge check</h2>
            {quizSummary.data && (
              <p className="text-sm text-muted-foreground">
                Best score: {Math.round(quizSummary.data.best_score * 100)}% ·{" "}
                {quizSummary.data.passed ? (
                  <span className="text-emerald-600">Passed</span>
                ) : (
                  <>
                    Passing:{" "}
                    {Math.round(quizSummary.data.min_passing_score * 100)}%
                  </>
                )}{" "}
                · {quizSummary.data.attempt_count} attempt
                {quizSummary.data.attempt_count === 1 ? "" : "s"}
              </p>
            )}
            <Quiz
              quiz={lesson.data.quiz}
              passingScore={quizSummary.data?.min_passing_score ?? 0.7}
              onServerSubmit={(body) => submitQuiz.mutateAsync(body)}
            />
            {hasQuiz && !quizPassed && (
              <p className="text-xs text-muted-foreground">
                You must pass the quiz before advancing to the next lesson.
              </p>
            )}
          </section>
        ) : null}
      </div>
    </LessonPage>
  );
}
