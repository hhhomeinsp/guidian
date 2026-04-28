"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const PLAN_LABELS: Record<string, string> = {
  learner: "Learner",
  pro: "Pro",
  organization: "Organization",
  org: "Organization",
};

const CONFETTI_COLORS = ["#0071E3", "#34C759", "#FF9500", "#FF3B30", "#C98A2A"];

function SuccessInner() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "learner";
  const planLabel = PLAN_LABELS[plan] ?? plan;

  return (
    <main className="container flex min-h-[70vh] items-center justify-center py-16">
      {/* Inject confetti keyframe once */}
      {/* eslint-disable-next-line react/no-danger */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .confetti-piece {
              position: absolute;
              top: -10px;
              left: var(--cp-x);
              width: 8px;
              height: 8px;
              background: var(--cp-color);
              border-radius: 2px;
              animation: confetti-fall 1.8s ease-in var(--cp-delay) both;
              opacity: 0;
            }
            @keyframes confetti-fall {
              0%   { transform: translateY(0)     rotate(0deg);   opacity: 1; }
              100% { transform: translateY(420px) rotate(720deg); opacity: 0; }
            }
          `,
        }}
      />

      <div className="relative text-center max-w-md overflow-hidden">
        {/* Confetti pieces */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={
                {
                  "--cp-delay": `${((i * 0.13) % 1.5).toFixed(2)}s`,
                  "--cp-x": `${(i * 37) % 100}%`,
                  "--cp-color": CONFETTI_COLORS[i % 5],
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <div className="relative z-10 rounded-2xl border border-[#D2D2D7] bg-white p-10 shadow-[0_8px_32px_rgba(0,0,0,0.10)]">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#34C759]/15">
              <svg
                className="h-8 w-8 text-[#34C759]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h1 className="font-display text-3xl font-semibold text-[#1D1D1F] mb-2">
            You&apos;re all set!
          </h1>
          <p className="font-body text-[#6E6E73] mb-8">
            Welcome to Guidian {planLabel}. Your subscription is now active.
          </p>
          <Link
            href="/courses"
            className="inline-block rounded-full bg-[#0071E3] px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0065CE]"
          >
            Start learning
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="container flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0071E3] border-t-transparent" />
        </main>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
