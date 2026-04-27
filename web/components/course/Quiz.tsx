"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
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
}

export function Quiz({ quiz, passingScore = 0.7, onSubmit, onServerSubmit }: QuizProps) {
  const [answers, setAnswers] = React.useState<Record<string, Answer>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [serverResult, setServerResult] = React.useState<QuizAttemptRead | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
      {error && <p className="font-body text-sm text-error">{error}</p>}
      <div className="flex items-center justify-between">
        <Button onClick={handleSubmit} disabled={submitted || pending}>
          {pending ? "Submitting…" : submitted ? "Submitted" : "Submit answers"}
        </Button>
        {submitted && (
          <p className="font-body text-sm">
            Score: <span className="font-semibold text-navy">{Math.round(score * 100)}%</span>{" "}
            {passed ? (
              <span className="text-teal font-medium">· Passed</span>
            ) : (
              <span className="text-error">· Not yet passing</span>
            )}
          </p>
        )}
      </div>
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
    <div className="rounded-xl border border-cloud bg-white shadow-card">
      <div className="border-b border-cloud px-5 py-4">
        <p className="font-display text-base font-semibold text-navy">
          <span className="text-steel font-normal">Q{index + 1}.</span> {question.prompt}
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
                      "w-full rounded-lg border px-4 py-2.5 text-left font-body text-sm transition-colors",
                      selected
                        ? "border-navy bg-navy text-white"
                        : "border-cloud bg-fog text-slate hover:border-navy/40 hover:bg-cloud",
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
              "mt-3 flex gap-2 rounded-lg p-3 font-body text-sm",
              correct
                ? "bg-success-bg text-success"
                : "bg-error-bg text-error",
            )}
          >
            {correct ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <X className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>{explanation ?? (correct ? "Correct." : "Incorrect.")}</span>
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
