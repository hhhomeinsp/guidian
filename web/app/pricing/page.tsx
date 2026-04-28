"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

const MONTHLY_PRICES = { learner: 29, pro: 59 };
const ANNUAL_PRICES = { learner: 24, pro: 49 };
const ANNUAL_BILLED = { learner: 288, pro: 588 };

const PLAN_FEATURES = {
  free: [
    { text: "Course browsing", included: true },
    { text: "1 course enrollment", included: true },
    { text: "Home inspector course (free trial)", included: true },
    { text: "Basic AI onboarding", included: true },
    { text: "Unlimited enrollments", included: false },
    { text: "Completion certificates", included: false },
    { text: "CE tracking dashboard", included: false },
    { text: "Personal AI Teacher", included: false },
  ],
  learner: [
    { text: "Course browsing", included: true },
    { text: "Unlimited course enrollments", included: true },
    { text: "Completion certificates", included: true },
    { text: "CE tracking dashboard", included: true },
    { text: "Course library access", included: true },
    { text: "Basic AI onboarding", included: true },
    { text: "Personal AI Teacher", included: false },
    { text: "Personalized study plans", included: false },
  ],
  pro: [
    { text: "Everything in Learner", included: true },
    { text: "Personal AI Teacher with memory", included: true },
    { text: "Unlimited Q&A with instructor", included: true },
    { text: "Personalized study plans", included: true },
    { text: "Proactive renewal reminders", included: true },
    { text: "Priority support", included: true },
  ],
  org: [
    { text: "Everything in Pro for all members", included: true },
    { text: "Branded portal", included: true },
    { text: "Group enrollment & compliance reporting", included: true },
    { text: "Admin dashboard", included: true },
    { text: "Dedicated account manager", included: true },
  ],
};

const COMPARISON_ROWS = [
  {
    label: "CE Tracking",
    free: false,
    learner: true,
    pro: true,
    org: true,
  },
  {
    label: "Course Library",
    free: "1 course" as const,
    learner: true,
    pro: true,
    org: true,
  },
  {
    label: "AI Onboarding",
    free: true,
    learner: true,
    pro: true,
    org: true,
  },
  {
    label: "AI Teacher + Memory",
    free: false,
    learner: false,
    pro: true,
    org: true,
  },
  {
    label: "Q&A with Instructor",
    free: false,
    learner: false,
    pro: true,
    org: true,
  },
  {
    label: "Certificates",
    free: false,
    learner: true,
    pro: true,
    org: true,
  },
  {
    label: "Org Portal",
    free: false,
    learner: false,
    pro: false,
    org: true,
  },
  {
    label: "Compliance Reports",
    free: false,
    learner: false,
    pro: false,
    org: true,
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (value === true)
    return <Check className="mx-auto h-4 w-4 text-[#34C759]" />;
  if (value === false)
    return <Minus className="mx-auto h-4 w-4 text-[#D2D2D7]" />;
  return <span className="text-xs text-[#6E6E73]">{value}</span>;
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("guidian.billing.annual");
    if (stored === "true") setAnnual(true);
  }, []);

  function toggleAnnual(val: boolean) {
    setAnnual(val);
    localStorage.setItem("guidian.billing.annual", String(val));
  }

  const learnerPrice = annual ? ANNUAL_PRICES.learner : MONTHLY_PRICES.learner;
  const proPrice = annual ? ANNUAL_PRICES.pro : MONTHLY_PRICES.pro;

  return (
    <main className="py-16 px-4">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl font-semibold text-[#1D1D1F] mb-3">
          Simple, transparent pricing
        </h1>
        <p className="font-body text-lg text-[#6E6E73]">
          From first lesson to final credential. Cancel anytime.
        </p>

        {/* Monthly / Annual toggle */}
        <div className="mt-8 inline-flex items-center rounded-full border border-[#D2D2D7] bg-white p-1 gap-1">
          <button
            onClick={() => toggleAnnual(false)}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              !annual
                ? "bg-[#1D1D1F] text-white"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => toggleAnnual(true)}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              annual
                ? "bg-[#1D1D1F] text-white"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            Annual
            <span className="ml-2 rounded-full bg-[#34C759] px-2 py-0.5 text-xs font-semibold text-white">
              2 months free
            </span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="container max-w-6xl mx-auto grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Free */}
        <div className="rounded-2xl border border-[#D2D2D7] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col">
          <div className="mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-3">
              Free
            </p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-[#1D1D1F]">Free</span>
            </div>
            <p className="text-sm text-[#6E6E73]">Always free, no card needed</p>
          </div>
          <ul className="space-y-2.5 mb-8 flex-1">
            {PLAN_FEATURES.free.map((f) => (
              <li key={f.text} className="flex items-start gap-2.5">
                {f.included ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#34C759]" />
                ) : (
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-[#D2D2D7]" />
                )}
                <span
                  className={`text-sm ${
                    f.included ? "text-[#1D1D1F]" : "text-[#8E8E93]"
                  }`}
                >
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/register"
            className="block rounded-full border border-[#D2D2D7] py-2.5 text-center text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-black/5"
          >
            Get started
          </Link>
        </div>

        {/* Learner */}
        <div className="rounded-2xl border border-[#D2D2D7] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col">
          <div className="mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-3">
              Learner
            </p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-[#1D1D1F]">
                ${learnerPrice}
              </span>
              <span className="mb-1 text-sm text-[#6E6E73]">/mo</span>
            </div>
            {annual ? (
              <p className="text-sm text-[#6E6E73]">
                Billed ${ANNUAL_BILLED.learner}/yr
              </p>
            ) : (
              <p className="text-sm text-[#6E6E73]">Billed monthly</p>
            )}
          </div>
          <ul className="space-y-2.5 mb-8 flex-1">
            {PLAN_FEATURES.learner.map((f) => (
              <li key={f.text} className="flex items-start gap-2.5">
                {f.included ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#34C759]" />
                ) : (
                  <Minus className="mt-0.5 h-4 w-4 shrink-0 text-[#D2D2D7]" />
                )}
                <span
                  className={`text-sm ${
                    f.included ? "text-[#1D1D1F]" : "text-[#8E8E93]"
                  }`}
                >
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={`/billing/checkout?plan=learner${annual ? "&annual=true" : ""}`}
            className="block rounded-full bg-[#1D1D1F] py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#1D1D1F]/90"
          >
            Start learning
          </Link>
        </div>

        {/* Pro — highlighted */}
        <div className="rounded-2xl border-2 border-[#0071E3] bg-white p-6 shadow-[0_8px_24px_rgba(0,113,227,0.15)] flex flex-col relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-[#0071E3] px-4 py-1 text-xs font-semibold text-white shadow">
              Most Popular
            </span>
          </div>
          <div className="mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#0071E3] mb-3">
              Pro
            </p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-[#1D1D1F]">
                ${proPrice}
              </span>
              <span className="mb-1 text-sm text-[#6E6E73]">/mo</span>
            </div>
            {annual ? (
              <p className="text-sm text-[#6E6E73]">
                Billed ${ANNUAL_BILLED.pro}/yr
              </p>
            ) : (
              <p className="text-sm text-[#6E6E73]">Billed monthly</p>
            )}
          </div>
          <ul className="space-y-2.5 mb-8 flex-1">
            {PLAN_FEATURES.pro.map((f) => (
              <li key={f.text} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#34C759]" />
                <span className="text-sm text-[#1D1D1F]">{f.text}</span>
              </li>
            ))}
          </ul>
          <Link
            href={`/billing/checkout?plan=pro${annual ? "&annual=true" : ""}`}
            className="block rounded-full bg-[#0071E3] py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#0065CE]"
          >
            Go Pro
          </Link>
        </div>

        {/* Organization */}
        <div className="rounded-2xl border border-[#D2D2D7] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col">
          <div className="mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-3">
              Organization
            </p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold text-[#1D1D1F]">Custom</span>
            </div>
            <p className="text-sm text-[#6E6E73]">Volume pricing available</p>
          </div>
          <ul className="space-y-2.5 mb-8 flex-1">
            {PLAN_FEATURES.org.map((f) => (
              <li key={f.text} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#34C759]" />
                <span className="text-sm text-[#1D1D1F]">{f.text}</span>
              </li>
            ))}
          </ul>
          <a
            href="mailto:sales@guidian.io"
            className="block rounded-full border border-[#D2D2D7] py-2.5 text-center text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-black/5"
          >
            Contact sales
          </a>
        </div>
      </div>

      {/* Comparison table — desktop only */}
      <div className="container max-w-6xl mx-auto mt-20 hidden lg:block">
        <h2 className="font-display text-2xl font-semibold text-[#1D1D1F] mb-8 text-center">
          Compare plans
        </h2>
        <div className="rounded-2xl border border-[#D2D2D7] bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F2F2F7]">
                <th className="py-4 px-6 text-left font-semibold text-[#1D1D1F] w-1/3">
                  Feature
                </th>
                {["Free", "Learner", "Pro", "Organization"].map((col) => (
                  <th
                    key={col}
                    className={`py-4 px-4 text-center font-semibold ${
                      col === "Pro" ? "text-[#0071E3]" : "text-[#1D1D1F]"
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 0 ? "bg-white" : "bg-[#F9F9FB]"}
                >
                  <td className="py-3.5 px-6 font-medium text-[#1D1D1F]">
                    {row.label}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <CellValue value={row.free} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <CellValue value={row.learner} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <CellValue value={row.pro} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <CellValue value={row.org} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-12 text-center font-body text-sm text-[#6E6E73]">
        All plans include a 7-day free trial. No credit card required for Free.
      </p>
    </main>
  );
}
