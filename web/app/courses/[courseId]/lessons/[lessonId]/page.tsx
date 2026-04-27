"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { AdaptiveRenderer, LessonPage, Quiz, SlideViewer } from "@/components/course";
import { AppHeader } from "@/components/AppHeader";

export default function LessonPlayerPage({
  params,
}: {
  params: { courseId: string; lessonId: string };
}) {
  const { courseId, lessonId } = params;
  const router = useRouter();
  // showSlides=true → slide deck; showSlides=false → quiz mode (after slides complete)
  const [showSlides, setShowSlides] = useState(true);
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
    return <main className="container py-12 font-body text-steel">Loading lesson…</main>;
  }
  if (lesson.error || !lesson.data) {
    return <main className="container py-12 font-body text-error">Failed to load lesson.</main>;
  }

  // --- Slide deck mode ---
  if (showSlides) {
    return (
      <div className="flex flex-col h-screen">
        <div className="shrink-0">
          <AppHeader />
        </div>
        <SlideViewer
          className="flex-1 min-h-0"
        lesson={lesson.data}
        lessonId={lessonId}
        onComplete={() => {
          // If there's a quiz, drop into quiz mode. Otherwise complete and navigate.
          if (hasQuiz) {
            setShowSlides(false);
          } else {
            handleComplete();
          }
        }}
        onBack={
          prev
            ? () => router.push(`/courses/${courseId}/lessons/${prev.id}`)
            : undefined
        }
      />
      </div>
    );
  }

  // --- Quiz / post-slides mode ---
  return (
    <LessonPage
      lesson={lesson.data}
      moduleTitle={current?.moduleTitle}
      progressPct={progressPct}
      onPrev={() => setShowSlides(true)}
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
            <h2 className="font-display text-xl font-semibold text-navy">Knowledge check</h2>
            {quizSummary.data && (
              <p className="font-body text-sm text-steel">
                Best score: {Math.round(quizSummary.data.best_score * 100)}% ·{" "}
                {quizSummary.data.passed ? (
                  <span className="text-teal font-medium">Passed</span>
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
