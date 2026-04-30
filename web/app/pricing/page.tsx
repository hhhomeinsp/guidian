"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { apiFetch, getAccessToken } from "@/lib/api/client";
import { COURSE_PRICES, formatPriceUSD } from "@/lib/pricing";

const TOP_COURSES = [
  "certified-home-inspector-100hr",
  "nmls-8hr-safe-act-ce",
  "ga-real-estate-ce-36hr",
  "fl-insurance-adjuster-ce-24hr",
  "fl-real-estate-ethics",
];

const PRO_FEATURES = [
  "Nova voice AI on every course you own",
  "Personalized study plans & memory",
  "Priority support",
  "Early access to new features",
];

export default function PricingPage() {
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    if (!getAccessToken()) {
      window.location.href = "/register?redirect=%2Fpricing";
      return;
    }
    setError(null);
    setUpgrading(true);
    try {
      const res = await apiFetch<{ checkout_url: string | null }>(
        "/billing/checkout",
        {
          method: "POST",
          body: JSON.stringify({ plan: "pro" }),
        },
      );
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      setError("Could not start checkout. Try again.");
    } catch {
      setError("Could not start checkout. Try again.");
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F5F7] py-16 px-4">
      <div className="container max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl font-semibold text-[#1D1D1F] mb-3">
            Simple pricing for serious learners
          </h1>
          <p className="font-body text-lg text-[#6E6E73]">
            Buy each course once. Add Pro to unlock Nova on every course you own.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Course Access */}
          <div className="rounded-2xl bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#D2D2D7] flex flex-col">
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-3">
                Course Access
              </p>
              <h2 className="font-display text-2xl font-semibold text-[#1D1D1F]">
                Pay per course. Keep it forever.
              </h2>
              <p className="mt-2 text-sm text-[#6E6E73]">
                One-time purchase. Lifetime access to course content, quizzes,
                final exam, and certificate.
              </p>
            </div>

            <ul className="mb-6 divide-y divide-[#F2F2F7]">
              {TOP_COURSES.map((slug) => {
                const info = COURSE_PRICES[slug];
                if (!info) return null;
                return (
                  <li
                    key={slug}
                    className="flex items-center justify-between py-3"
                  >
                    <span className="text-sm text-[#1D1D1F]">{info.label}</span>
                    <span className="text-sm font-semibold text-[#1D1D1F]">
                      {formatPriceUSD(info.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <Link
              href="/courses"
              className="mt-auto inline-flex items-center justify-center rounded-full bg-[#0071E3] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0077ED]"
            >
              Browse All Courses →
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl bg-white p-8 shadow-[0_8px_24px_rgba(0,113,227,0.12)] border-2 border-[#0071E3] flex flex-col relative">
            <div className="absolute -top-3 left-8">
              <span className="rounded-full bg-[#0071E3] px-3 py-1 text-xs font-semibold text-white">
                With Nova AI
              </span>
            </div>
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#0071E3] mb-3">
                Pro
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold text-[#1D1D1F]">$19</span>
                <span className="mb-1 text-sm text-[#6E6E73]">/mo</span>
              </div>
              <p className="text-sm text-[#6E6E73]">
                Unlock Nova AI on every course you own.
              </p>
            </div>

            <ul className="mb-8 space-y-3 flex-1">
              {PRO_FEATURES.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#34C759]" />
                  <span className="text-sm text-[#1D1D1F]">{feat}</span>
                </li>
              ))}
            </ul>

            {error && (
              <p className="mb-3 text-sm text-[#FF3B30]">{error}</p>
            )}

            <button
              type="button"
              onClick={handleUpgrade}
              disabled={upgrading}
              className="inline-flex items-center justify-center rounded-full bg-[#0071E3] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0077ED] disabled:opacity-60"
            >
              {upgrading ? "Starting checkout…" : "Upgrade to Pro"}
            </button>
            <p className="mt-3 text-center text-xs text-[#6E6E73]">
              Cancel anytime. Pro requires at least one owned course.
            </p>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-[#6E6E73]">
          Need something custom?{" "}
          <a
            href="mailto:sales@guidian.io"
            className="text-[#0071E3] underline"
          >
            Contact sales
          </a>{" "}
          for organization plans.
        </p>
      </div>
    </main>
  );
}
