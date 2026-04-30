"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

interface PurchaseInfo {
  course_id: string;
  course_title: string | null;
  status: string;
  amount_cents: number;
}

function CourseSuccessInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [purchase, setPurchase] = useState<PurchaseInfo | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setErrored(true);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12; // ~30s with 2.5s interval

    async function poll() {
      attempts += 1;
      try {
        const data = await apiFetch<PurchaseInfo>(
          `/billing/course/session/${sessionId}`,
        );
        if (cancelled) return;
        setPurchase(data);
        if (data.status !== "completed" && attempts < maxAttempts) {
          setTimeout(poll, 2500);
        }
      } catch {
        if (cancelled) return;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2500);
        } else {
          setErrored(true);
        }
      }
    }
    void poll();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-[#F5F5F7] flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#D2D2D7] bg-white p-10 text-center shadow-[0_8px_32px_rgba(0,0,0,0.10)]">
        <div className="mb-6 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#34C759]/15">
            <Check className="h-8 w-8 text-[#34C759]" strokeWidth={2.5} />
          </div>
        </div>
        <h1 className="font-display text-3xl font-semibold text-[#1D1D1F] mb-2">
          You&apos;re enrolled! 🎉
        </h1>

        {purchase?.course_title && (
          <p className="font-body text-base text-[#1D1D1F] mb-2">
            {purchase.course_title}
          </p>
        )}

        {!purchase && !errored && (
          <p className="font-body text-sm text-[#6E6E73] mb-6">
            Confirming your purchase…
          </p>
        )}
        {purchase && purchase.status !== "completed" && (
          <p className="font-body text-sm text-[#6E6E73] mb-6">
            Finalizing your enrollment…
          </p>
        )}
        {errored && !purchase && (
          <p className="font-body text-sm text-[#6E6E73] mb-6">
            We&apos;re still confirming your purchase. It will appear in your
            courses shortly.
          </p>
        )}
        {purchase?.status === "completed" && (
          <p className="font-body text-sm text-[#6E6E73] mb-8">
            Lifetime access. Add Pro any time to unlock Nova AI.
          </p>
        )}

        {purchase?.course_id ? (
          <Link
            href={`/courses/${purchase.course_id}`}
            className="inline-block rounded-full bg-[#0071E3] px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0077ED]"
          >
            Start Learning →
          </Link>
        ) : (
          <Link
            href="/courses"
            className="inline-block rounded-full bg-[#0071E3] px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0077ED]"
          >
            Go to my courses
          </Link>
        )}
      </div>
    </main>
  );
}

export default function CourseSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="container flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0071E3] border-t-transparent" />
        </main>
      }
    >
      <CourseSuccessInner />
    </Suspense>
  );
}
