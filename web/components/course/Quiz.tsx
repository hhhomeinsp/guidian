"use client";

import * as React from "react";
import { Check, RefreshCw, X } from "lucide-react";
import type { QuizAnswer, QuizAttemptRead, QuizPayload, QuizQuestion } from "@/lib/api/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Answer = number[] | boolean | null;

export interface QuizResult {
  score: number; // 0..1
  passed: boolean;
  answers: Record<string, Answer>;
}

export interface QuizProps {
  quiz: QuizPayload;
  passingScore?: number; // 0..1 — only used for local scoring fallback
  /**
   * Client-only callback (deprecated path). Prefer `onServerSubmit` which
   * receives the authoritative server attempt response.
   */
  onSubmit?: (result: QuizResult) => void;
  /**
   * Async submitter. If provided, the component POSTs answers to the server
   * and displays the authoritative `QuizAttemptRead` feedback. The local
   * scoring pass is skipped.
   */
  onServerSubmit?: (body: {
    answers: Record<string, QuizAnswer>;
  }) => Promise<QuizAttemptRead>;
  /** Fired when the learner clicks "Retake quiz" after a failed attempt. */
  onRetake?: () => void;
}

export function Quiz({ quiz, passingScore = 0.7, onSubmit, onServerSubmit, onRetake }: QuizProps) {
  const [answers, setAnswers] = React.useState<Record<string, Answer>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [serverResult, setServerResult] = React.useState<QuizAttemptRead | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRetake = () => {
    setAnswers({});
    setSubmitted(false);
    setServerResult(null);
    setError(null);
    onRetake?.();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const serverFeedback = React.useMemo(() => {
    if (!serverResult) return null;
    const map = new Map<string, { correct: boolean; explanation?: string | null }>();
    for (const r of serverResult.per_question) {
      map.set(r.question_id, { correct: r.correct, explanation: r.explanation });
    }
    return map;
  }, [serverResult]);

  const setAnswer = (qid: string, value: Answer) =>
    setAnswers((a) => ({ ...a, [qid]: value }));

  const score = React.useMemo(() => {
    if (!submitted) return 0;
    if (serverResult) return serverResult.score;
    const correct = quiz.questions.reduce((acc, q) => (isCorrect(q, answers[q.id]) ? acc + 1 : acc), 0);
    return quiz.questions.length ? correct / quiz.questions.length : 0;
  }, [submitted, serverResult, quiz.questions, answers]);

  const passed = serverResult ? serverResult.passed : score >= passingScore;
  const totalQuestions = quiz.questions.length;
  const correctCount = React.useMemo(() => {
    if (!submitted) return 0;
    if (serverResult) return serverResult.per_question.filter((r) => r.correct).length;
    return quiz.questions.reduce((acc, q) => (isCorrect(q, answers[q.id]) ? acc + 1 : acc), 0);
  }, [submitted, serverResult, quiz.questions, answers]);
  const passingPct = Math.round((serverResult ? passingScore : passingScore) * 100);

  const toServerAnswers = (): Record<string, QuizAnswer> => {
    const out: Record<string, QuizAnswer> = {};
    for (const q of quiz.questions) {
      const a = answers[q.id];
      if (a === null || a === undefined) continue;
      if (q.type === "true_false") {
        out[q.id] = a as boolean;
      } else if (q.type === "single_choice") {
        out[q.id] = Array.isArray(a) ? (a[0] as number) : (a as unknown as number);
      } else {
        out[q.id] = Array.isArray(a) ? (a as number[]) : [];
      }
    }
    return out;
  };

  const handleSubmit = async () => {
    setError(null);
    if (onServerSubmit) {
      setPending(true);
      try {
        const result = await onServerSubmit({ answers: toServerAnswers() });
        setServerResult(result);
        setSubmitted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submission failed");
      } finally {
        setPending(false);
      }
      return;
    }
    setSubmitted(true);
    const s =
      quiz.questions.reduce((acc, q) => (isCorrect(q, answers[q.id]) ? acc + 1 : acc), 0) /
      Math.max(1, quiz.questions.length);
    onSubmit?.({ score: s, passed: s >= passingScore, answers });
  };

  return (
    <div className="space-y-6">
      {quiz.questions.map((q, idx) => (
        <QuestionCard
          key={q.id}
          index={idx}
          question={q}
          value={answers[q.id] ?? null}
          onChange={(v) => setAnswer(q.id, v)}
          submitted={submitted}
          serverFeedback={serverFeedback?.get(q.id) ?? null}
        />
      ))}
      {error && <p className="text-sm text-[#FF3B30]">{error}</p>}

      {submitted ? (
        <div
          className={cn(
            "rounded-[18px] border bg-white px-5 py-5 shadow-card",
            passed ? "border-[#34C759]/40" : "border-[#FF3B30]/40",
          )}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                passed ? "bg-[#34C759]/10" : "bg-[#FF3B30]/10",
              )}
              aria-hidden
            >
              {passed ? (
                <Check className="h-5 w-5 text-[#34C759]" />
              ) : (
                <X className="h-5 w-5 text-[#FF3B30]" />
              )}
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold text-[#1D1D1F]">
                You scored {correctCount}/{totalQuestions} ({Math.round(score * 100)}%)
                {passed ? (
                  <span className="text-[#34C759]"> — Passed!</span>
                ) : (
                  <span className="text-[#FF3B30]"> — Needs {passingPct}% to pass</span>
                )}
              </p>
              <p className="mt-1 text-xs text-[#6E6E73]">
                {passed
                  ? "Great work. You can advance to the next lesson."
                  : "Review the explanations above, then retake to advance."}
              </p>
            </div>
            {!passed && (
              <Button
                onClick={handleRetake}
                size="sm"
                className="rounded-full bg-[#0071E3] text-white hover:bg-[#0077ED]"
              >
                <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
                Retake quiz
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Submitting…" : "Submit answers"}
          </Button>
          <p className="text-xs text-[#6E6E73]">
            {totalQuestions} question{totalQuestions === 1 ? "" : "s"} · {passingPct}% to pass
          </p>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  index,
  value,
  onChange,
  submitted,
  serverFeedback,
}: {
  question: QuizQuestion;
  index: number;
  value: Answer;
  onChange: (v: Answer) => void;
  submitted: boolean;
  serverFeedback: { correct: boolean; explanation?: string | null } | null;
}) {
  const correct = submitted
    ? (serverFeedback ? serverFeedback.correct : isCorrect(question, value))
    : null;
  const explanation = serverFeedback?.explanation ?? question.explanation;

  return (
    <div className="rounded-[18px] border border-[#D2D2D7] bg-white shadow-card">
      <div className="border-b border-[#D2D2D7] px-5 py-4">
        <p className="text-base font-semibold text-[#1D1D1F]">
          <span className="text-[#6E6E73] font-normal">Q{index + 1}.</span> {question.prompt}
        </p>
      </div>
      <div className="px-5 py-4 space-y-2">
        {question.type === "true_false" ? (
          <div className="flex gap-2">
            {[true, false].map((tf) => (
              <Button
                key={String(tf)}
                variant={value === tf ? "default" : "outline"}
                size="sm"
                disabled={submitted}
                onClick={() => onChange(tf)}
              >
                {tf ? "True" : "False"}
              </Button>
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {question.choices.map((choice, i) => {
              const selected =
                question.type === "multiple_choice"
                  ? Array.isArray(value) && value.includes(i)
                  : value === i || (Array.isArray(value) && value[0] === i);
              const showCorrect = submitted && selected && correct === true;
              const showIncorrect = submitted && selected && correct === false;
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={submitted}
                    onClick={() => {
                      if (question.type === "multiple_choice") {
                        const cur = Array.isArray(value) ? value : [];
                        onChange(cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]);
                      } else {
                        onChange([i]);
                      }
                    }}
                    className={cn(
                      "w-full rounded-[10px] border-[1.5px] px-4 py-2.5 text-left text-sm transition-colors",
                      showCorrect
                        ? "border-[#34C759] bg-[#F0FFF4] text-[#1D1D1F]"
                        : showIncorrect
                          ? "border-[#FF3B30] bg-[#FFF2F1] text-[#1D1D1F]"
                          : selected
                            ? "border-[#0071E3] bg-[#E8F0FE] text-[#1D1D1F]"
                            : "border-[#D2D2D7] bg-white text-[#1D1D1F] hover:border-[#0071E3]/40 hover:bg-[#E8F0FE]/30",
                      submitted && "cursor-default",
                    )}
                  >
                    {choice}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {submitted && (
          <div
            className={cn(
              "mt-3 flex gap-2 rounded-[10px] p-3 text-sm",
              correct ? "bg-[#F0FFF4]" : "bg-[#FFF2F1]",
            )}
          >
            {correct
              ? <Check className="h-4 w-4 shrink-0 mt-0.5 text-[#34C759]" />
              : <X className="h-4 w-4 shrink-0 mt-0.5 text-[#FF3B30]" />}
            <span className="text-[#1D1D1F]">{explanation ?? (correct ? "Correct." : "Incorrect.")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function isCorrect(q: QuizQuestion, answer: Answer): boolean {
  if (answer === null || answer === undefined) return false;
  if (q.type === "true_false") return answer === q.correct;
  const expected = Array.isArray(q.correct) ? q.correct : typeof q.correct === "number" ? [q.correct] : [];
  const got = Array.isArray(answer) ? answer : [];
  if (expected.length !== got.length) return false;
  const a = [...expected].sort();
  const b = [...got].sort();
  return a.every((v, i) => v === b[i]);
}
