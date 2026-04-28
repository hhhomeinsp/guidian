"use client";

import Link from "next/link";
import {
  BookOpen,
  Award,
  Mic,
  Shield,
  Zap,
  BarChart,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      {/* 1. HERO */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center px-5 text-center"
        style={{ background: "linear-gradient(180deg, #ffffff 0%, #f5f5f7 100%)" }}
      >
        <div className="mx-auto w-full max-w-[1100px]">
          <p
            className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6E6E73]"
          >
            AI-Native Learning Platform
          </p>
          <h1
            className="mx-auto max-w-[780px] text-[48px] font-bold leading-[1.05] text-[#1D1D1F] md:text-[80px]"
            style={{ letterSpacing: "-2px" }}
          >
            From first lesson
            <br />
            to final credential.
          </h1>
          <p
            className="mx-auto mt-6 max-w-lg text-[18px] leading-relaxed text-[#6E6E73] md:text-[20px]"
          >
            The AI platform that generates, delivers, and tracks continuing
            education for every stage of a professional&apos;s career.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#0071E3] px-8 text-[15px] font-medium text-white transition-colors hover:bg-[#0077ED]"
            >
              Start learning free
            </Link>
            <Link
              href="/courses"
              className="inline-flex h-12 items-center justify-center px-4 text-[15px] font-medium text-[#1D1D1F] transition-opacity hover:opacity-60"
            >
              See the platform →
            </Link>
          </div>
          <p className="mt-5 text-[13px] text-[#6E6E73]">
            No credit card required&nbsp;&nbsp;·&nbsp;&nbsp;7-day free
            trial&nbsp;&nbsp;·&nbsp;&nbsp;CE-compliant certificates
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-[#6E6E73]">
          <ChevronDown className="h-5 w-5" />
        </div>
      </section>

      {/* 2. LOGO STRIP / SOCIAL PROOF */}
      <section className="bg-[#F5F5F7] px-5 py-14">
        <div className="mx-auto max-w-[1100px] text-center">
          <p className="mb-6 text-[13px] font-medium text-[#6E6E73]">
            Trusted by licensed professionals in
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-0 gap-y-3">
            {[
              "Home Inspectors",
              "Real Estate Agents",
              "Insurance Adjusters",
              "Contractors",
              "Cosmetologists",
              "Nurses",
            ].map((prof, i, arr) => (
              <span key={prof} className="flex items-center">
                <span className="text-[15px] font-medium text-[#1D1D1F]">
                  {prof}
                </span>
                {i < arr.length - 1 && (
                  <span className="mx-4 text-[#D2D2D7]">·</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 3. FEATURES */}
      <section className="bg-white px-5 py-24">
        <div className="mx-auto max-w-[1100px]">
          <h2
            className="mb-3 text-center text-[36px] font-bold text-[#1D1D1F] md:text-[44px]"
            style={{ letterSpacing: "-1px" }}
          >
            Everything you need to stay licensed.
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[17px] text-[#6E6E73]">
            One platform handles the entire CE lifecycle, from course creation to
            certificate delivery.
          </p>
          <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<BookOpen className="h-5 w-5 text-[#0071E3]" />}
              title="AI Course Generation"
              description="Type a topic and get a fully structured CE course in minutes. Modules, lessons, quizzes, and narration — all generated."
            />
            <Feature
              icon={<Zap className="h-5 w-5 text-[#0071E3]" />}
              title="Adaptive Learning"
              description="Every learner gets a different experience based on how they learn best — visual, auditory, reading, or hands-on."
            />
            <Feature
              icon={<Mic className="h-5 w-5 text-[#0071E3]" />}
              title="Audio Narration"
              description="Every lesson is narrated by ElevenLabs AI. Listen while you commute, work, or study at your own pace."
            />
            <Feature
              icon={<Shield className="h-5 w-5 text-[#0071E3]" />}
              title="CE Compliance"
              description="CEU hours tracked, certificates issued, audit trails maintained. Approved for state licensing boards."
            />
            <Feature
              icon={<BarChart className="h-5 w-5 text-[#0071E3]" />}
              title="AI Teacher"
              description="Your personal AI instructor remembers your progress, answers questions, and adapts to your learning style over time."
            />
            <Feature
              icon={<Award className="h-5 w-5 text-[#0071E3]" />}
              title="Instant Certificates"
              description="Server-issued PDFs with verification codes. Accepted by licensing boards and employers."
            />
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="bg-[#F5F5F7] px-5 py-24">
        <div className="mx-auto max-w-[1100px]">
          <h2
            className="mb-3 text-center text-[36px] font-bold text-[#1D1D1F] md:text-[44px]"
            style={{ letterSpacing: "-1px" }}
          >
            Three steps to your next credential.
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[17px] text-[#6E6E73]">
            Simple enough to start today. Powerful enough to carry your entire
            career.
          </p>
          <div className="relative grid gap-12 md:grid-cols-3 md:gap-6">
            {/* Connector line (desktop only) */}
            <div
              className="absolute left-[16.67%] right-[16.67%] top-6 hidden h-px bg-[#D2D2D7] md:block"
              aria-hidden="true"
            />
            {[
              {
                n: "1",
                title: "Choose your profession",
                desc: "Browse courses built for your license type and state requirements.",
              },
              {
                n: "2",
                title: "Learn your way",
                desc: "Your AI instructor guides you through every module. Audio, visual, or text — you choose.",
              },
              {
                n: "3",
                title: "Earn your certificate",
                desc: "Pass the assessment, download your certificate, and submit to your licensing board.",
              },
            ].map((step) => (
              <div key={step.n} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F0FE]">
                  <span className="text-[15px] font-bold text-[#0071E3]">
                    {step.n}
                  </span>
                </div>
                <h3 className="mb-2 text-[17px] font-semibold text-[#1D1D1F]">
                  {step.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-[#6E6E73]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. PRICING TEASER */}
      <section className="bg-white px-5 py-24">
        <div className="mx-auto max-w-[1100px] text-center">
          <h2
            className="mb-3 text-[36px] font-bold text-[#1D1D1F] md:text-[44px]"
            style={{ letterSpacing: "-1px" }}
          >
            Simple pricing. No surprises.
          </h2>
          <p className="mx-auto mb-14 max-w-md text-[17px] text-[#6E6E73]">
            Start free. Upgrade when you&apos;re ready.
          </p>
          <div className="mx-auto flex max-w-2xl flex-col gap-5 sm:flex-row">
            {/* Free */}
            <div className="flex flex-1 flex-col rounded-[20px] border border-[#D2D2D7] p-8 text-left">
              <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#6E6E73]">
                Free
              </p>
              <p className="mb-1 text-[40px] font-bold text-[#1D1D1F]">$0</p>
              <p className="mb-6 text-[13px] text-[#6E6E73]">per month</p>
              <p className="mb-8 flex-1 text-[14px] text-[#6E6E73]">
                1 course, basic AI onboarding
              </p>
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#1D1D1F] px-6 text-[14px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
              >
                Get started free
              </Link>
            </div>
            {/* Pro */}
            <div className="flex flex-1 flex-col rounded-[20px] border-2 border-[#0071E3] p-8 text-left">
              <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#0071E3]">
                Pro
              </p>
              <p className="mb-1 text-[40px] font-bold text-[#1D1D1F]">$59</p>
              <p className="mb-6 text-[13px] text-[#6E6E73]">per month</p>
              <p className="mb-8 flex-1 text-[14px] text-[#6E6E73]">
                Unlimited courses, AI Teacher with memory, all certificates
              </p>
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#0071E3] px-6 text-[14px] font-medium text-white transition-colors hover:bg-[#0077ED]"
              >
                Start Pro trial
              </Link>
            </div>
          </div>
          <p className="mt-8">
            <Link
              href="/courses"
              className="text-[14px] text-[#0071E3] hover:underline"
            >
              See full pricing →
            </Link>
          </p>
        </div>
      </section>

      {/* 6. FINAL CTA */}
      <section className="bg-[#1D1D1F] px-5 py-24 text-center">
        <div className="mx-auto max-w-[1100px]">
          <h2
            className="mx-auto mb-5 max-w-xl text-[36px] font-bold leading-[1.05] text-white md:text-[52px]"
            style={{ letterSpacing: "-1.5px" }}
          >
            Your career doesn&apos;t wait.
            <br />
            Start learning today.
          </h2>
          <p className="mx-auto mb-10 max-w-md text-[17px] text-[#A1A1A6]">
            Join professionals keeping their licenses current with AI-powered CE.
          </p>
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#0071E3] px-8 text-[15px] font-medium text-white transition-colors hover:bg-[#0077ED]"
          >
            Get started free →
          </Link>
          <p className="mt-4 text-[13px] text-[#6E6E73]">
            No credit card required
          </p>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="bg-white px-5 py-14">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/brand/logo-light.svg" alt="Guidian" width={100} height={18} />
            <span className="text-[13px] text-[#6E6E73]">
              From first lesson to final credential.
            </span>
          </div>
          <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2">
            {[
              { label: "Courses", href: "/courses" },
              { label: "Pricing", href: "/courses" },
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Contact", href: "mailto:compliance@guidian.io" },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F]"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <p className="text-[12px] text-[#A1A1A6]">
            © 2026 Guidian Learning Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F0FE]">
        {icon}
      </div>
      <h3 className="mb-2 text-[17px] font-semibold text-[#1D1D1F]">{title}</h3>
      <p className="text-[14px] leading-relaxed text-[#6E6E73]">{description}</p>
    </div>
  );
}
