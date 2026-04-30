"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useNovaContext } from "@/components/NovaProvider";
import { apiFetch } from "@/lib/api/client";
import { Lock } from "lucide-react";


function ComplianceToast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2"
    >
      <div className="flex items-center gap-2 rounded-full bg-[#1D1D1F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
        <Lock className="h-4 w-4" aria-hidden />
        <span>{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-2 rounded-full px-2 py-0.5 text-xs text-[#F5F5F7] hover:bg-white/10"
        >
          Got it
        </button>
      </div>
    </div>
  );
}


export default function LessonPlayerPage({
  params,
}: {
  params: { courseId: string; lessonId: string };
}) {
  const { courseId, lessonId } = params;
  const router = useRouter();
  const { setNovaContext } = useNovaContext();
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

  // Compliance gate — set when learner has not visited every slide / met seat time
  const [gateMessage, setGateMessage] = useState<string | null>(null);

  // Auto-dismiss the gate toast after 4s
  useEffect(() => {
    if (!gateMessage) return;
    const id = window.setTimeout(() => setGateMessage(null), 4000);
    return () => window.clearTimeout(id);
  }, [gateMessage]);

  const checkSlideCompliance = useCallback(async (): Promise<boolean> => {
    try {
      const progress = await apiFetch<{
        slides_visited: number[];
        time_spent_ms: number;
        completed_at: string | null;
        completion_pct: number;
      }>(`/courses/lessons/${lessonId}/progress`);
      return progress?.completed_at != null;
    } catch {
      return false;
    }
  }, [lessonId]);

  const handleComplete = async () => {
    const compliant = await checkSlideCompliance();
    if (!compliant) {
      setGateMessage("Please complete all slides to continue");
      return;
    }
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

  // Tell Nova which lesson is active (must be before early returns — Rules of Hooks)
  useEffect(() => {
    if (!lesson.data?.title) return;
    setNovaContext(courseId, lesson.data.title);
    return () => setNovaContext(null, null);
  }, [courseId, lesson.data?.title, setNovaContext]);

  if (lesson.isLoading || course.isLoading) {
    return <main className="container py-12 font-body text-steel">Loading lesson…</main>;
  }
  if (lesson.error || !lesson.data) {
    return <main className="container py-12 font-body text-error">Failed to load lesson.</main>;
  }
  // --- Slide deck mode ---
  if (showSlides) {
    return (
      <ErrorBoundary>
      <div className="flex flex-col h-[calc(100vh-3.625rem)]">
        <SlideViewer
          className="flex-1 min-h-0"
        lesson={lesson.data}
        lessonId={lessonId}
        onComplete={async () => {
          // If there's a quiz, drop into quiz mode. Otherwise complete and navigate.
          if (hasQuiz) {
            const compliant = await checkSlideCompliance();
            if (!compliant) {
              setGateMessage("Please complete all slides to continue");
              return;
            }
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
      <ComplianceToast message={gateMessage} onDismiss={() => setGateMessage(null)} />
      </div>
      </ErrorBoundary>
    );
  }


  // --- Quiz / post-slides mode ---
  return (
    <>
    <ComplianceToast message={gateMessage} onDismiss={() => setGateMessage(null)} />
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
    </>
  );
}
