"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  useCourse,
  useExamStatus,
  useIssueCertificate,
  useMyCertificates,
  useStartExam,
  useSubmitExam,
} from "@/lib/api/hooks";
import type {
  ExamAttemptRead,
  ExamQuestionPublic,
  ExamQuestionsRead,
  QuizAnswer,
} from "@/lib/api/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LocalAnswer = number[] | boolean | null;

export default function ExamPage({ params }: { params: { courseId: string } }) {
  const { courseId } = params;
  const router = useRouter();
  const course = useCourse(courseId);
  const status = useExamStatus(courseId);
  const startExam = useStartExam(courseId);
  const submitExam = useSubmitExam(courseId);
  const myCerts = useMyCertificates();
  const issueCert = useIssueCertificate(courseId);

  const [exam, setExam] = React.useState<ExamQuestionsRead | null>(null);
  const [result, setResult] = React.useState<ExamAttemptRead | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, LocalAnswer>>({});
  const [currentQ, setCurrentQ] = React.useState(0);
  const [confirmingSubmit, setConfirmingSubmit] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const phase: "pre" | "in_progress" | "result" = exam
    ? result
      ? "result"
      : "in_progress"
    : "pre";

  // ----- Timer -----
  const [secondsRemaining, setSecondsRemaining] = React.useState(0);
  const startedAtRef = React.useRef<number | null>(null);
  const submitInFlightRef = React.useRef(false);

  const submitNow = React.useCallback(
    async (auto = false) => {
      if (!exam || submitInFlightRef.current) return;
      submitInFlightRef.current = true;
      const started = startedAtRef.current ?? Date.now();
      const time_spent_ms = Math.max(0, Date.now() - started);
      try {
        const serverAnswers: Record<string, QuizAnswer> = {};
        for (const q of exam.questions) {
          const a = answers[q.id];
          if (a === null || a === undefined) continue;
          if (q.type === "true_false") {
            serverAnswers[q.id] = a as boolean;
          } else if (q.type === "single_choice") {
            serverAnswers[q.id] = Array.isArray(a) ? (a[0] as number) : (a as unknown as number);
          } else {
            serverAnswers[q.id] = Array.isArray(a) ? (a as number[]) : [];
          }
        }
        const r = await submitExam.mutateAsync({ answers: serverAnswers, time_spent_ms });
        setResult(r);
        setConfirmingSubmit(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submission failed");
      } finally {
        submitInFlightRef.current = false;
        if (auto) setConfirmingSubmit(false);
      }
    },
    [answers, exam, submitExam],
  );

  React.useEffect(() => {
    if (phase !== "in_progress" || !exam) return;
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
      setSecondsRemaining(exam.time_limit_seconds);
    }
    const id = window.setInterval(() => {
      setSecondsRemaining((s) => {
        const next = s - 1;
        if (next <= 0) {
          window.clearInterval(id);
          // auto-submit on time-out
          void submitNow(true);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, exam, submitNow]);

  const beginExam = async () => {
    setError(null);
    try {
      const data = await startExam.mutateAsync();
      setExam(data);
      setAnswers({});
      setResult(null);
      setCurrentQ(0);
      startedAtRef.current = Date.now();
      setSecondsRemaining(data.time_limit_seconds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start exam");
    }
  };

  const retake = () => {
    setExam(null);
    setResult(null);
    setAnswers({});
    setCurrentQ(0);
    startedAtRef.current = null;
    setSecondsRemaining(0);
    void beginExam();
  };

  if (course.isLoading || status.isLoading) {
    return (
      <Shell>
        <p className="text-sm text-[#6E6E73]">Loading exam…</p>
      </Shell>
    );
  }

  if (course.error || !course.data) {
    return (
      <Shell>
        <p className="text-sm text-[#FF3B30]">Course not found.</p>
      </Shell>
    );
  }

  // ===== PRE-EXAM SCREEN =====
  if (phase === "pre") {
    return (
      <Shell>
        <PreExamScreen
          courseId={courseId}
          courseTitle={course.data.title}
          unlocked={status.data?.unlocked ?? false}
          lessonsCompleted={status.data?.lessons_completed ?? 0}
          lessonsTotal={status.data?.lessons_total ?? 0}
          attemptCount={status.data?.attempt_count ?? 0}
          bestScore={status.data?.best_score ?? 0}
          passed={status.data?.passed ?? false}
          passingScore={status.data?.passing_score ?? 0.75}
          starting={startExam.isPending}
          error={error}
          onStart={beginExam}
          existingCertId={
            myCerts.data?.find((c) => c.course_id === courseId)?.id ?? null
          }
          onIssueCertificate={() => issueCert.mutate()}
          issuingCertificate={issueCert.isPending}
        />
      </Shell>
    );
  }

  // ===== RESULT SCREEN =====
  if (phase === "result" && result) {
    return (
      <Shell>
        <ResultScreen
          result={result}
          courseId={courseId}
          courseTitle={course.data.title}
          existingCertId={
            myCerts.data?.find((c) => c.course_id === courseId)?.id ?? null
          }
          onIssueCertificate={() => issueCert.mutate()}
          issuingCertificate={issueCert.isPending}
          onRetake={retake}
          onBackToCourse={() => router.push(`/courses/${courseId}`)}
        />
      </Shell>
    );
  }

  // ===== IN-PROGRESS EXAM =====
  const currentQuestion = exam!.questions[currentQ];
  const answeredCount = Object.values(answers).filter(
    (a) => a !== null && a !== undefined && (Array.isArray(a) ? a.length > 0 : true),
  ).length;
  const totalQ = exam!.questions.length;

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <ExamHeader
        secondsRemaining={secondsRemaining}
        currentQ={currentQ}
        totalQ={totalQ}
        answeredCount={answeredCount}
      />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
        {error && (
          <div className="mb-4 rounded-xl border border-[#FF3B30]/30 bg-[#FFF2F1] px-4 py-3 text-sm text-[#FF3B30]">
            {error}
          </div>
        )}

        <QuestionStepper
          question={currentQuestion}
          index={currentQ}
          total={totalQ}
          value={answers[currentQuestion.id] ?? null}
          onChange={(v) =>
            setAnswers((a) => ({ ...a, [currentQuestion.id]: v }))
          }
        />

        <nav className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentQ((q) => Math.max(0, q - 1))}
            disabled={currentQ === 0}
            className="rounded-full border-[#D2D2D7] text-[#1D1D1F]"
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Previous
          </Button>

          {currentQ < totalQ - 1 ? (
            <Button
              onClick={() => setCurrentQ((q) => Math.min(totalQ - 1, q + 1))}
              className="rounded-full bg-[#0071E3] text-white hover:bg-[#0077ED]"
            >
              Next <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button
              onClick={() => setConfirmingSubmit(true)}
              className="rounded-full bg-[#0071E3] text-white hover:bg-[#0077ED]"
            >
              Submit exam <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          )}
        </nav>

        {/* Question grid jumper */}
        <section className="mt-10 rounded-2xl border border-[#D2D2D7] bg-white p-5 shadow-card">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[#6E6E73]">
            Jump to question
          </p>
          <div className="flex flex-wrap gap-2">
            {exam!.questions.map((q, idx) => {
              const a = answers[q.id];
              const isAnswered =
                a !== null && a !== undefined && (Array.isArray(a) ? a.length > 0 : true);
              const isCurrent = idx === currentQ;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQ(idx)}
                  className={cn(
                    "h-9 w-9 rounded-lg border text-sm font-medium transition-colors",
                    isCurrent
                      ? "border-[#0071E3] bg-[#0071E3] text-white"
                      : isAnswered
                        ? "border-[#0071E3]/40 bg-[#E8F0FE] text-[#0071E3]"
                        : "border-[#D2D2D7] bg-white text-[#6E6E73] hover:border-[#0071E3]/40",
                  )}
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={`Question ${idx + 1}${isAnswered ? ", answered" : ", unanswered"}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {confirmingSubmit && (
        <ConfirmSubmitDialog
          answeredCount={answeredCount}
          totalQ={totalQ}
          onCancel={() => setConfirmingSubmit(false)}
          onConfirm={() => void submitNow()}
          submitting={submitExam.isPending}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Pre-exam screen
// -------------------------------------------------------------
function PreExamScreen({
  courseId,
  courseTitle,
  unlocked,
  lessonsCompleted,
  lessonsTotal,
  attemptCount,
  bestScore,
  passed,
  passingScore,
  starting,
  error,
  onStart,
  existingCertId,
  onIssueCertificate,
  issuingCertificate,
}: {
  courseId: string;
  courseTitle: string;
  unlocked: boolean;
  lessonsCompleted: number;
  lessonsTotal: number;
  attemptCount: number;
  bestScore: number;
  passed: boolean;
  passingScore: number;
  starting: boolean;
  error: string | null;
  onStart: () => void;
  existingCertId: string | null;
  onIssueCertificate: () => void;
  issuingCertificate: boolean;
}) {
  const passingPct = Math.round(passingScore * 100);

  return (
    <>
      <Link
        href={`/courses/${courseId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0071E3] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to course
      </Link>

      <div className="rounded-3xl border border-[#D2D2D7] bg-white px-6 py-10 shadow-card md:px-12 md:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#0071E3]/10">
            <Award className="h-7 w-7 text-[#0071E3]" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1D1D1F] md:text-4xl">
            Final Exam
          </h1>
          <p className="mt-2 text-base text-[#6E6E73] md:text-lg">{courseTitle}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat icon={<FileText className="h-5 w-5" />} label="Up to 50 questions" />
            <Stat icon={<Clock className="h-5 w-5" />} label="90 minute time limit" />
            <Stat icon={<ShieldCheck className="h-5 w-5" />} label={`${passingPct}% to pass`} />
          </div>

          {attemptCount > 0 && (
            <div className="mt-6 rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-5 py-4 text-sm text-[#1D1D1F]">
              <p>
                Best attempt:{" "}
                <span className="font-semibold">{Math.round(bestScore * 100)}%</span> ·{" "}
                {passed ? (
                  <span className="text-[#34C759] font-medium">Passed</span>
                ) : (
                  <span className="text-[#FF3B30]">Not yet passing</span>
                )}{" "}
                · {attemptCount} attempt{attemptCount === 1 ? "" : "s"}
              </p>
            </div>
          )}

          {!unlocked ? (
            <div className="mt-8 rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-5 py-5 text-left">
              <div className="mb-3 flex items-center gap-2">
                <Lock className="h-5 w-5 text-[#6E6E73]" aria-hidden />
                <p className="text-sm font-semibold text-[#1D1D1F]">
                  Complete all lessons to unlock the exam
                </p>
              </div>
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[#D2D2D7]">
                <div
                  className="h-full bg-[#0071E3] transition-all duration-300"
                  style={{
                    width: `${lessonsTotal ? Math.min(100, (lessonsCompleted / lessonsTotal) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-[#6E6E73]">
                {lessonsCompleted} of {lessonsTotal} lessons completed
              </p>
              <Link
                href={`/courses/${courseId}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#0071E3] hover:underline"
              >
                Go to lessons <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="mt-8 flex flex-col items-center gap-3">
              {error && (
                <div className="w-full rounded-xl border border-[#FF3B30]/30 bg-[#FFF2F1] px-4 py-3 text-left text-sm text-[#FF3B30]">
                  {error}
                </div>
              )}
              <Button
                onClick={onStart}
                disabled={starting}
                className="rounded-full bg-[#0071E3] px-10 py-3 text-base font-semibold text-white hover:bg-[#0077ED]"
              >
                {starting ? "Starting…" : passed ? "Retake exam" : "Start exam"}
              </Button>
              {passed && (
                <ExamCertificateRow
                  existingCertId={existingCertId}
                  onIssueCertificate={onIssueCertificate}
                  issuingCertificate={issuingCertificate}
                />
              )}
              <p className="text-xs text-[#6E6E73]">
                Once you start, the timer runs continuously. You can navigate back to review answers.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] px-4 py-3 text-sm text-[#1D1D1F]">
      <span className="text-[#0071E3]" aria-hidden>
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function ExamCertificateRow({
  existingCertId,
  onIssueCertificate,
  issuingCertificate,
}: {
  existingCertId: string | null;
  onIssueCertificate: () => void;
  issuingCertificate: boolean;
}) {
  if (existingCertId) {
    return (
      <Link
        href={`/certificates/${existingCertId}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#1D1D1F] px-6 py-2 text-sm font-medium text-white hover:bg-[#2A2A2D]"
      >
        Download certificate <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    );
  }
  return (
    <Button
      onClick={onIssueCertificate}
      disabled={issuingCertificate}
      variant="outline"
      className="rounded-full border-[#D2D2D7] text-[#1D1D1F]"
    >
      {issuingCertificate ? "Issuing certificate…" : "Issue certificate"}
    </Button>
  );
}

// -------------------------------------------------------------
// Result screen
// -------------------------------------------------------------
function ResultScreen({
  result,
  courseId,
  courseTitle,
  existingCertId,
  onIssueCertificate,
  issuingCertificate,
  onRetake,
  onBackToCourse,
}: {
  result: ExamAttemptRead;
  courseId: string;
  courseTitle: string;
  existingCertId: string | null;
  onIssueCertificate: () => void;
  issuingCertificate: boolean;
  onRetake: () => void;
  onBackToCourse: () => void;
}) {
  const pct = Math.round(result.score_pct * 100);
  return (
    <>
      <div className="rounded-3xl border border-[#D2D2D7] bg-white px-6 py-10 shadow-card md:px-12 md:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <div
            className={cn(
              "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full",
              result.passed ? "bg-[#34C759]/10" : "bg-[#FF3B30]/10",
            )}
          >
            {result.passed ? (
              <Check className="h-8 w-8 text-[#34C759]" aria-hidden />
            ) : (
              <X className="h-8 w-8 text-[#FF3B30]" aria-hidden />
            )}
          </div>

          <p className="text-sm font-medium uppercase tracking-wider text-[#6E6E73]">
            {courseTitle}
          </p>
          <h1
            className={cn(
              "mt-2 text-5xl font-bold tracking-tight md:text-6xl",
              result.passed ? "text-[#34C759]" : "text-[#FF3B30]",
            )}
          >
            {pct}%
          </h1>
          <p className="mt-2 text-xl font-semibold text-[#1D1D1F] md:text-2xl">
            {result.passed ? "Passed!" : "Not Passed"}
          </p>
          <p className="mt-3 text-sm text-[#6E6E73]">
            {result.correct_count} of {result.total_count} questions correct ·{" "}
            attempt #{result.attempt_number}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            {result.passed ? (
              existingCertId ? (
                <Link
                  href={`/certificates/${existingCertId}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-8 py-3 text-base font-semibold text-white hover:bg-[#0077ED]"
                >
                  Download certificate <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              ) : (
                <Button
                  onClick={onIssueCertificate}
                  disabled={issuingCertificate}
                  className="rounded-full bg-[#0071E3] px-8 py-3 text-base font-semibold text-white hover:bg-[#0077ED]"
                >
                  {issuingCertificate ? "Issuing certificate…" : "Issue certificate"}
                </Button>
              )
            ) : (
              <Button
                onClick={onRetake}
                className="rounded-full bg-[#0071E3] px-8 py-3 text-base font-semibold text-white hover:bg-[#0077ED]"
              >
                <RefreshCw className="mr-2 h-5 w-5" aria-hidden /> Retake exam
              </Button>
            )}
            <button
              onClick={onBackToCourse}
              className="text-sm font-medium text-[#0071E3] hover:underline"
            >
              Back to course overview
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// -------------------------------------------------------------
// Header (timer + progress)
// -------------------------------------------------------------
function ExamHeader({
  secondsRemaining,
  currentQ,
  totalQ,
  answeredCount,
}: {
  secondsRemaining: number;
  currentQ: number;
  totalQ: number;
  answeredCount: number;
}) {
  const mm = Math.floor(secondsRemaining / 60);
  const ss = secondsRemaining % 60;
  const lowTime = secondsRemaining > 0 && secondsRemaining <= 5 * 60;
  const pct = totalQ ? ((currentQ + 1) / totalQ) * 100 : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-[#D2D2D7] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wider text-[#6E6E73]">
            Final Exam
          </span>
          <span className="text-sm font-semibold text-[#1D1D1F]">
            Question {currentQ + 1} of {totalQ}
            <span className="ml-2 text-xs font-normal text-[#6E6E73]">
              · {answeredCount} answered
            </span>
          </span>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums",
            lowTime
              ? "border-[#FF3B30] bg-[#FFF2F1] text-[#FF3B30]"
              : "border-[#D2D2D7] bg-[#F5F5F7] text-[#1D1D1F]",
          )}
          role="timer"
          aria-live="polite"
        >
          <Clock className="h-4 w-4" aria-hidden />
          {mm}:{ss.toString().padStart(2, "0")}
        </div>
      </div>
      <div className="h-1 w-full bg-[#F5F5F7]">
        <div
          className="h-full bg-[#0071E3] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </header>
  );
}

// -------------------------------------------------------------
// Question card (single question at a time)
// -------------------------------------------------------------
function QuestionStepper({
  question,
  index,
  total,
  value,
  onChange,
}: {
  question: ExamQuestionPublic;
  index: number;
  total: number;
  value: LocalAnswer;
  onChange: (v: LocalAnswer) => void;
}) {
  return (
    <article className="rounded-3xl border border-[#D2D2D7] bg-white px-6 py-7 shadow-card md:px-8 md:py-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
        Question {index + 1} of {total}
      </p>
      <h2 className="text-xl font-semibold leading-snug text-[#1D1D1F] md:text-2xl">
        {question.prompt}
      </h2>

      <div className="mt-6 space-y-2">
        {question.type === "true_false" ? (
          <div className="flex gap-3">
            {[true, false].map((tf) => (
              <button
                key={String(tf)}
                onClick={() => onChange(tf)}
                className={cn(
                  "flex-1 rounded-2xl border-[1.5px] px-5 py-4 text-base font-medium transition-colors",
                  value === tf
                    ? "border-[#0071E3] bg-[#E8F0FE] text-[#0071E3]"
                    : "border-[#D2D2D7] bg-white text-[#1D1D1F] hover:border-[#0071E3]/40",
                )}
              >
                {tf ? "True" : "False"}
              </button>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {question.choices.map((choice, i) => {
              const selected =
                question.type === "multiple_choice"
                  ? Array.isArray(value) && value.includes(i)
                  : Array.isArray(value) && value[0] === i;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      if (question.type === "multiple_choice") {
                        const cur = Array.isArray(value) ? value : [];
                        onChange(cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]);
                      } else {
                        onChange([i]);
                      }
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border-[1.5px] px-5 py-4 text-left text-base transition-colors",
                      selected
                        ? "border-[#0071E3] bg-[#E8F0FE] text-[#1D1D1F]"
                        : "border-[#D2D2D7] bg-white text-[#1D1D1F] hover:border-[#0071E3]/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-semibold",
                        selected
                          ? "border-[#0071E3] bg-[#0071E3] text-white"
                          : "border-[#D2D2D7] bg-white text-[#6E6E73]",
                      )}
                      aria-hidden
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="leading-relaxed">{choice}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {question.type === "multiple_choice" && (
        <p className="mt-3 text-xs text-[#6E6E73]">Select all that apply.</p>
      )}
    </article>
  );
}

// -------------------------------------------------------------
// Confirm-submit dialog
// -------------------------------------------------------------
function ConfirmSubmitDialog({
  answeredCount,
  totalQ,
  onCancel,
  onConfirm,
  submitting,
}: {
  answeredCount: number;
  totalQ: number;
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const unanswered = totalQ - answeredCount;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-submit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <div className="mb-3 flex items-center gap-2 text-[#FF9F0A]">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          <h3 id="confirm-submit-title" className="text-lg font-semibold text-[#1D1D1F]">
            Submit final exam?
          </h3>
        </div>
        <p className="text-sm text-[#6E6E73]">
          You answered {answeredCount} of {totalQ} questions
          {unanswered > 0 && (
            <span className="font-medium text-[#1D1D1F]">
              {" "}
              ({unanswered} unanswered)
            </span>
          )}
          . Once submitted, the exam will be graded and you cannot change your answers.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-full border-[#D2D2D7] text-[#1D1D1F]"
          >
            Keep reviewing
          </Button>
          <Button
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-full bg-[#0071E3] text-white hover:bg-[#0077ED]"
          >
            {submitting ? "Submitting…" : "Submit exam"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Shell
// -------------------------------------------------------------
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F5F5F7]">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:px-6 md:py-12">
        {children}
      </div>
    </main>
  );
}
