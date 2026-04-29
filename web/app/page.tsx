"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { BookOpen, Award, Mic, Shield, Zap, BarChart, ChevronDown } from "lucide-react";

/* ── Loading progress bar ─────────────────────────────────────────────────── */
function LoadingBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999] h-[2px]"
      style={{
        background: "linear-gradient(90deg, #0071E3, #5AC8FA)",
        animation: "loadBar 1.5s ease-out forwards",
        transformOrigin: "left",
      }}
    />
  );
}

/* ── Animated counter hook ────────────────────────────────────────────────── */
function useCounter(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return { count, ref };
}

/* ── Audio waveform ───────────────────────────────────────────────────────── */
function Waveform() {
  return (
    <div className="flex gap-[3px] items-center h-5">
      {[0.4, 0.8, 0.6, 1.0, 0.5, 0.9, 0.3, 0.7].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-[#0071E3]"
          style={{
            height: `${h * 100}%`,
            animation: `wave ${0.8 + i * 0.1}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── MacBook CSS mockup ───────────────────────────────────────────────────── */
function MacBookMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      {/* Body */}
      <div
        className="relative rounded-[16px] bg-[#1C1C1E]"
        style={{
          paddingTop: "62%",
          boxShadow:
            "0 40px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div className="absolute inset-0 rounded-[16px] overflow-hidden">
          {/* Camera / notch bar */}
          <div className="absolute top-0 left-0 right-0 h-7 bg-[#161618] flex items-center justify-center">
            <div className="w-16 h-4 bg-[#161618] rounded-b-[8px] flex items-center justify-center">
              <div className="w-[6px] h-[6px] rounded-full bg-[#2A2A2C]" />
            </div>
          </div>
          {/* Screen */}
          <div
            className="absolute rounded-[8px] overflow-hidden"
            style={{
              inset: "28px 12px 12px 12px",
              background: "linear-gradient(135deg, #0A0A14 0%, #0D1425 100%)",
            }}
          >
            {/* Title bar */}
            <div className="h-9 bg-[#111827] flex items-center px-4 gap-3 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
              </div>
              <div className="flex-1 text-center text-[9px] text-[#6E6E73] font-medium">
                Guidian — Module 3: Electrical Systems
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1 bg-[#1F2937]">
              <div className="h-full w-[55%] bg-gradient-to-r from-[#0071E3] to-[#5AC8FA]" />
            </div>
            {/* Content */}
            <div className="p-4 flex flex-col gap-3">
              <div className="text-[8px] font-semibold text-[#0071E3] tracking-widest uppercase">
                Module 3 · Lesson 2
              </div>
              <div className="text-[13px] font-bold text-white leading-tight">
                Service Panel Safety &<br />Load Calculations
              </div>
              <div className="text-[7px] text-[#9CA3AF] leading-relaxed">
                Arc-fault circuit interrupters (AFCIs) protect against electrical fires
                caused by arcing faults. Modern panels require AFCI protection in bedrooms,
                living rooms, and all 15A / 20A branch circuits.
              </div>
              {/* Mini bar chart */}
              <div className="mt-1 rounded-[6px] bg-[#0F172A] border border-white/5 p-2.5">
                {[
                  ["Main", 85],
                  ["Kitchen", 60],
                  ["HVAC", 90],
                  ["Bath", 45],
                  ["Lighting", 75],
                ].map(([label, pct]) => (
                  <div key={label as string} className="flex items-center gap-1.5 mb-1 last:mb-0">
                    <div className="text-[5px] text-[#6E6E73] w-9">{label}</div>
                    <div className="h-1.5 flex-1 rounded-full bg-[#1F2937]">
                      <div
                        className="h-full rounded-full bg-[#0071E3]"
                        style={{ width: `${pct}%`, opacity: 0.8 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Audio bar */}
              <div className="flex items-center gap-2 rounded-[6px] bg-[#111827] border border-white/5 px-2.5 py-2">
                <div className="w-5 h-5 rounded-full bg-[#0071E3] flex items-center justify-center flex-shrink-0">
                  <div
                    className="w-0 h-0 ml-0.5"
                    style={{
                      borderTop: "3px solid transparent",
                      borderBottom: "3px solid transparent",
                      borderLeft: "5px solid white",
                    }}
                  />
                </div>
                <Waveform />
                <div className="ml-auto text-[7px] text-[#6E6E73] font-mono">
                  12 / 22 slides
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Keyboard hint */}
      <div
        className="h-3 mx-6 bg-[#2A2A2C] rounded-b-[4px]"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
      />
      <div className="h-1.5 mx-0 bg-[#1C1C1E] rounded-b-[6px]" />
    </div>
  );
}

/* ── Phone mockup with Nova chat ──────────────────────────────────────────── */
function PhoneMockup() {
  return (
    <div
      className="relative w-[160px] flex-shrink-0 hidden md:block"
      style={{
        transform: "rotate(-8deg) translateY(20px)",
        filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.4))",
      }}
    >
      <div
        className="rounded-[28px] bg-[#1C1C1E] p-1.5"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.08)" }}
      >
        <div className="rounded-[20px] overflow-hidden bg-[#0A0A14]">
          {/* Status bar */}
          <div className="h-6 bg-[#111827] flex items-center justify-between px-3">
            <span className="text-[7px] text-white font-semibold">9:41</span>
            <div className="w-10 h-3 rounded-full bg-[#1C1C1E]" />
            <div className="w-3 h-1.5 rounded-sm bg-white/60" />
          </div>
          {/* Nova header */}
          <div className="h-8 bg-[#111827] border-b border-white/5 flex items-center px-3 gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#0071E3] to-[#5AC8FA] flex items-center justify-center">
              <span className="text-[5px] font-bold text-white">N</span>
            </div>
            <span className="text-[8px] font-semibold text-white">
              Nova · AI Instructor
            </span>
          </div>
          {/* Chat bubbles */}
          <div className="p-2.5 flex flex-col gap-2 min-h-[180px]">
            <div className="self-end max-w-[80%] bg-[#0071E3] rounded-[10px] rounded-br-[3px] px-2 py-1.5">
              <p className="text-[6.5px] text-white leading-relaxed">
                What&apos;s the passing score for Texas electrical CE?
              </p>
            </div>
            <div className="self-start max-w-[90%] bg-[#1F2937] rounded-[10px] rounded-bl-[3px] px-2 py-1.5">
              <p className="text-[6.5px] text-[#E5E7EB] leading-relaxed">
                You need 70% or higher. You&apos;re at 68% — want me to review
                arc-fault circuits with you?
              </p>
            </div>
            {/* Typing dots */}
            <div className="self-start bg-[#1F2937] rounded-full px-3 py-1.5 flex gap-1 items-center">
              {[0, 0.2, 0.4].map((d, i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-[#6B7280]"
                  style={{
                    animation: "pulseDot 1.2s ease-in-out infinite",
                    animationDelay: `${d}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat counter ─────────────────────────────────────────────────────────── */
function StatCounter({
  value,
  label,
  suffix = "",
}: {
  value: number;
  label: string;
  suffix?: string;
}) {
  const { count, ref } = useCounter(value);
  return (
    <div ref={ref} className="text-center px-4 py-2">
      <div
        className="text-[32px] md:text-[40px] font-bold text-[#1D1D1F]"
        style={{ letterSpacing: "-0.03em" }}
      >
        {count}
        {suffix}
      </div>
      <div className="mt-1 text-[13px] text-[#6E6E73]">{label}</div>
    </div>
  );
}

/* ── Feature card ─────────────────────────────────────────────────────────── */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      className="group rounded-[16px] border border-[#E5E5EA] bg-white p-7"
      whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.10)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#E8F0FE]">
        {icon}
      </div>
      <h3 className="mb-2 text-[16px] font-semibold text-[#1D1D1F] leading-snug">
        {title}
      </h3>
      <p className="text-[14px] leading-relaxed text-[#6E6E73]">{description}</p>
    </motion.div>
  );
}

/* ── Profession card ──────────────────────────────────────────────────────── */
function ProfessionCard({
  icon,
  name,
  count,
}: {
  icon: string;
  name: string;
  count: string;
}) {
  return (
    <motion.div
      className="group flex flex-col gap-3 rounded-[16px] border border-[#E5E5EA] bg-white p-6 cursor-pointer"
      whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.08)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#F5F5F7] text-2xl group-hover:scale-110 transition-transform duration-200">
        {icon}
      </div>
      <div>
        <h3 className="text-[15px] font-semibold text-[#1D1D1F]">{name}</h3>
        <p className="mt-0.5 text-[12px] text-[#6E6E73]">{count}</p>
      </div>
      <Link
        href="/courses"
        className="mt-auto text-[13px] font-medium text-[#0071E3] hover:underline"
      >
        View courses →
      </Link>
    </motion.div>
  );
}

/* ── Story panel wrapper ──────────────────────────────────────────────────── */
function StoryPanel({
  n,
  title,
  description,
  children,
  delay = 0,
  flip = false,
}: {
  n: string;
  title: string;
  description: string;
  children: React.ReactNode;
  delay?: number;
  flip?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className={`flex flex-col items-start gap-10 md:items-center ${flip ? "md:flex-row-reverse" : "md:flex-row"}`}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex-1 min-w-0">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0071E3]">
          Step {n}
        </div>
        <h3
          className="mb-4 text-[26px] md:text-[32px] font-bold text-[#1D1D1F]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {title}
        </h3>
        <p className="text-[16px] leading-relaxed text-[#6E6E73] max-w-sm">
          {description}
        </p>
      </div>
      <div className="w-full md:w-[440px] flex-shrink-0">{children}</div>
    </motion.div>
  );
}

/* ── Typing + outline demo ────────────────────────────────────────────────── */
function TypingDemo() {
  const fullText = "Home Inspector CE — Electrical Systems";
  const [typed, setTyped] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const timer = setInterval(() => {
      setTyped(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [inView]);

  const modules = [
    "Module 1: Service Panel Fundamentals",
    "Module 2: Branch Circuit Analysis",
    "Module 3: GFCI & AFCI Requirements",
    "Module 4: Grounding Systems",
  ];
  const done = typed.length === fullText.length;

  return (
    <div
      ref={ref}
      className="rounded-[16px] bg-[#F5F5F7] border border-[#E5E5EA] overflow-hidden"
    >
      <div className="p-4 border-b border-[#E5E5EA] bg-white flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
        </div>
        <span className="text-[11px] text-[#6E6E73] ml-2">Course Generator</span>
      </div>
      <div className="p-5">
        <div className="mb-3 text-[12px] text-[#6E6E73] font-medium">
          What topic would you like to teach?
        </div>
        <div className="rounded-[8px] bg-white border border-[#D2D2D7] px-3 py-2.5 text-[13px] text-[#1D1D1F] font-mono min-h-[40px] flex items-center">
          {typed}
          {!done && inView && (
            <span className="ml-0.5 inline-block w-0.5 h-4 bg-[#0071E3] animate-pulse" />
          )}
        </div>
        {done && (
          <motion.div
            className="mt-5 space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-[11px] text-[#6E6E73] font-medium mb-3">
              Generated outline:
            </div>
            {modules.map((m, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-2.5 rounded-[8px] bg-white border border-[#E5E5EA] px-3 py-2.5"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="w-5 h-5 rounded-full bg-[#E8F0FE] flex items-center justify-center text-[9px] font-bold text-[#0071E3] flex-shrink-0">
                  {i + 1}
                </div>
                <span className="text-[12px] text-[#1D1D1F]">{m}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ── Generation progress bars ─────────────────────────────────────────────── */
function GenerationDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  const modules = [
    { name: "Service Panel Fundamentals", pct: 100 },
    { name: "Branch Circuit Analysis", pct: 100 },
    { name: "GFCI & AFCI Requirements", pct: 78 },
    { name: "Grounding Systems", pct: 0 },
  ];

  return (
    <div
      ref={ref}
      className="rounded-[16px] bg-white border border-[#E5E5EA] overflow-hidden"
    >
      <div className="p-4 border-b border-[#E5E5EA] bg-[#F5F5F7] flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[#1D1D1F]">
          AI Writing Course...
        </span>
        <span className="text-[11px] text-[#0071E3] font-medium animate-pulse">
          ● Generating
        </span>
      </div>
      <div className="p-5 space-y-5">
        {modules.map((m, i) => (
          <div key={i}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] text-[#1D1D1F] font-medium">
                {m.name}
              </span>
              <span className="text-[11px] text-[#6E6E73]">
                {m.pct === 100 ? "✓" : m.pct === 0 ? "—" : `${m.pct}%`}
              </span>
            </div>
            <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#0071E3] to-[#5AC8FA]"
                initial={{ width: 0 }}
                animate={inView ? { width: `${m.pct}%` } : { width: 0 }}
                transition={{ duration: 1, delay: i * 0.3, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 text-[11px] text-[#6E6E73] pt-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0071E3] animate-pulse flex-shrink-0" />
          Generating lesson content, quizzes &amp; narration...
        </div>
      </div>
    </div>
  );
}

/* ── Device showcase ──────────────────────────────────────────────────────── */
function DeviceShowcase() {
  return (
    <div className="relative h-[220px] flex items-center">
      {/* Tablet / laptop card */}
      <motion.div
        className="absolute left-0 top-4 w-[200px] rounded-[12px] bg-[#1C1C1E] p-1.5"
        initial={{ opacity: 0, x: -40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}
      >
        <div className="rounded-[8px] overflow-hidden bg-[#0A0A14]">
          <div className="h-7 bg-[#111827] flex items-center justify-center border-b border-white/5">
            <span className="text-[7px] text-[#6E6E73]">Guidian · Lesson Player</span>
          </div>
          <div className="p-3">
            <div className="text-[6px] text-[#0071E3] font-semibold uppercase tracking-wider mb-1">
              Module 3
            </div>
            <div className="text-[10px] text-white font-bold leading-tight mb-2">
              Electrical Safety Basics
            </div>
            <div className="h-1 bg-[#1F2937] rounded-full mb-3">
              <div className="h-full w-[45%] bg-[#0071E3] rounded-full" />
            </div>
            <div className="text-[6px] text-[#9CA3AF] leading-relaxed">
              Arc-fault circuit interrupters protect against electrical fires caused
              by arcing faults in home wiring systems. Required in all sleeping areas.
            </div>
          </div>
        </div>
      </motion.div>
      {/* Phone */}
      <motion.div
        className="absolute right-0 bottom-0 w-[105px] rounded-[18px] bg-[#1C1C1E] p-1"
        initial={{ opacity: 0, x: 40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
          transform: "rotate(5deg)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
        }}
      >
        <div className="rounded-[14px] overflow-hidden bg-[#0A0A14]">
          <div className="h-5 bg-[#111827] flex items-center justify-center">
            <span className="text-[5px] text-[#6E6E73]">Nova AI</span>
          </div>
          <div className="p-2 space-y-1.5">
            <div className="bg-[#0071E3] rounded-[6px] rounded-br-[2px] px-1.5 py-1">
              <p className="text-[5px] text-white">Need help with GFCI?</p>
            </div>
            <div className="bg-[#1F2937] rounded-[6px] rounded-bl-[2px] px-1.5 py-1">
              <p className="text-[5px] text-[#E5E7EB] leading-relaxed">
                GFCI outlets protect against ground faults and are required within 6ft of water.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      {/* Global keyframe CSS */}
      <style>{`
        @keyframes loadBar {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes wave {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>

      <LoadingBar />

      {/* ── 1. HERO ────────────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center px-5 pt-24 pb-20 text-center"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,113,227,0.15), transparent),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(22,45,74,0.10), transparent),
            #FFFFFF
          `,
        }}
      >
        <div className="mx-auto w-full max-w-[1100px]">
          <motion.p
            className="mb-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6E6E73]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            AI-Native Learning Platform
          </motion.p>

          <motion.h1
            className="mx-auto max-w-[920px] font-bold"
            style={{
              fontSize: "clamp(64px, 10vw, 120px)",
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              background:
                "linear-gradient(135deg, #1D1D1F 0%, #162D4A 50%, #0071E3 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            From first lesson
            <br />
            to final credential.
          </motion.h1>

          <motion.p
            className="mx-auto mt-8 max-w-lg text-[18px] leading-relaxed text-[#6E6E73] md:text-[20px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.25 }}
          >
            The AI platform that generates, delivers, and tracks continuing
            education for every stage of a professional&apos;s career.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#0071E3] px-8 text-[15px] font-medium text-white transition-all hover:bg-[#0077ED] hover:scale-[1.02] hover:shadow-lg"
            >
              Start learning free
            </Link>
            <Link
              href="/courses"
              className="inline-flex h-12 items-center justify-center px-4 text-[15px] font-medium text-[#1D1D1F] transition-opacity hover:opacity-60"
            >
              See the platform →
            </Link>
          </motion.div>

          <motion.p
            className="mt-5 text-[13px] text-[#6E6E73]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            No credit card required&nbsp;&nbsp;·&nbsp;&nbsp;7-day free
            trial&nbsp;&nbsp;·&nbsp;&nbsp;CE-compliant certificates
          </motion.p>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-[#6E6E73]">
          <ChevronDown className="h-5 w-5" />
        </div>
      </section>

      {/* ── 2. DEVICE MOCKUP ───────────────────────────────────────────────── */}
      <section className="bg-[#F5F5F7] px-5 py-20 overflow-hidden">
        <div className="mx-auto max-w-[1100px]">
          <motion.div
            className="flex flex-col items-center gap-8 md:flex-row md:items-end md:justify-center md:gap-10"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <MacBookMockup />
            <PhoneMockup />
          </motion.div>
          <p className="mt-8 text-center text-[13px] text-[#6E6E73]">
            Study anywhere — desktop, tablet, or mobile
          </p>
        </div>
      </section>

      {/* ── 3. STATS STRIP ─────────────────────────────────────────────────── */}
      <section className="bg-white px-5 py-16 border-y border-[#E5E5EA]">
        <div className="mx-auto max-w-[1100px]">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-0 md:divide-x md:divide-[#E5E5EA]">
            <StatCounter value={6} label="States covered" />
            <StatCounter value={11} label="Professions served" />
            <StatCounter value={90} label="Seconds to generate a course" suffix="s" />
            <StatCounter value={100} label="Online CE approved" suffix="%" />
          </div>
        </div>
      </section>

      {/* ── 4. SOCIAL PROOF STRIP ──────────────────────────────────────────── */}
      <section className="bg-[#F5F5F7] px-5 py-14">
        <div className="mx-auto max-w-[1100px] text-center">
          <p className="mb-6 text-[13px] font-medium text-[#6E6E73]">
            Trusted by licensed professionals in
          </p>
          <div className="flex flex-wrap items-center justify-center">
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

      {/* ── 5. SCROLL STORY ────────────────────────────────────────────────── */}
      <section className="bg-white px-5 py-24">
        <div className="mx-auto max-w-[1100px]">
          <h2
            className="mb-3 text-center text-[36px] font-bold text-[#1D1D1F] md:text-[48px]"
            style={{ letterSpacing: "-0.03em" }}
          >
            See how it works.
          </h2>
          <p className="mx-auto mb-20 max-w-lg text-center text-[17px] text-[#6E6E73]">
            From idea to live CE course in under two minutes.
          </p>

          <div className="space-y-24">
            <StoryPanel
              n="01"
              title="Type a topic."
              description="Type any subject — a state board requirement, a professional skill, a safety topic. Guidian builds the full course structure instantly."
              delay={0}
            >
              <TypingDemo />
            </StoryPanel>

            <StoryPanel
              n="02"
              title="AI writes the course."
              description="Claude generates each module: lesson content, quiz questions, diagrams, and professional narration. No curriculum writers needed."
              delay={0.1}
              flip
            >
              <GenerationDemo />
            </StoryPanel>

            <StoryPanel
              n="03"
              title="Learners study everywhere."
              description="Desktop, tablet, phone. Slide-by-slide with audio narration. Nova, your AI instructor, answers questions in real time."
              delay={0.2}
            >
              <DeviceShowcase />
            </StoryPanel>
          </div>
        </div>
      </section>

      {/* ── 6. FEATURES ────────────────────────────────────────────────────── */}
      <section className="bg-[#F5F5F7] px-5 py-24">
        <div className="mx-auto max-w-[1100px]">
          <h2
            className="mb-3 text-center text-[36px] font-bold text-[#1D1D1F] md:text-[44px]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Everything you need to stay licensed.
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[17px] text-[#6E6E73]">
            One platform handles the entire CE lifecycle, from course creation to
            certificate delivery.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<BookOpen className="h-5 w-5 text-[#0071E3]" />}
              title="Generate a 4-hour CE course in 90 seconds"
              description="Type a topic and get a fully structured CE course: modules, lessons, quizzes, and narration — all generated and state-board ready."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5 text-[#0071E3]" />}
              title="Adaptive Learning"
              description="Every learner gets a different experience based on how they learn best — visual, auditory, reading, or hands-on."
            />
            <FeatureCard
              icon={<Mic className="h-5 w-5 text-[#0071E3]" />}
              title="ElevenLabs narration, downloadable for offline"
              description="Every lesson narrated by ElevenLabs AI in professional voices. Listen while you commute, work, or study at your own pace."
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5 text-[#0071E3]" />}
              title="CEU tracking & certificates built for state boards"
              description="CEU hours tracked, certificates issued, audit trails maintained. Approved for state licensing boards in 6 states."
            />
            <FeatureCard
              icon={<BarChart className="h-5 w-5 text-[#0071E3]" />}
              title="Nova — your AI instructor who remembers every session"
              description="Your personal AI instructor remembers your progress, answers questions, and adapts to your learning style over time."
            />
            <FeatureCard
              icon={<Award className="h-5 w-5 text-[#0071E3]" />}
              title="Instant Certificates"
              description="Server-signed PDFs with verification codes. Accepted by licensing boards and employers."
            />
          </div>
        </div>
      </section>

      {/* ── 7. SECURITY STRIP ──────────────────────────────────────────────── */}
      <section className="bg-[#1D1D1F] px-5 py-16">
        <div className="mx-auto max-w-[1100px] text-center">
          <h2
            className="mb-3 text-[28px] font-bold text-white md:text-[36px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Built for state board compliance.
          </h2>
          <p className="mx-auto mb-12 max-w-md text-[15px] text-[#A1A1A6]">
            Every CEU hour tracked. Every certificate verifiable. Every audit trail
            immutable.
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {[
              { icon: "🔐", label: "Append-only audit logs" },
              { icon: "📋", label: "xAPI statement tracking" },
              { icon: "🏆", label: "Server-signed certificates" },
              { icon: "🔒", label: "SOC 2 Type II (planned)" },
            ].map((badge) => (
              <div
                key={badge.label}
                className="flex flex-col items-center gap-3 rounded-[12px] border border-white/10 bg-white/5 px-4 py-6"
              >
                <span className="text-2xl">{badge.icon}</span>
                <span className="text-[13px] font-medium text-white text-center">
                  {badge.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. BUILT FOR PROFESSIONALS ─────────────────────────────────────── */}
      <section className="bg-white px-5 py-24">
        <div className="mx-auto max-w-[1100px]">
          <h2
            className="mb-3 text-center text-[36px] font-bold text-[#1D1D1F] md:text-[44px]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Built for professionals.
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-[17px] text-[#6E6E73]">
            CE courses purpose-built for your license type and state requirements.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ProfessionCard
              icon="🏠"
              name="Home Inspectors"
              count="52,000+ licensed professionals"
            />
            <ProfessionCard
              icon="🏡"
              name="Real Estate Agents"
              count="1.5M+ licensed agents"
            />
            <ProfessionCard
              icon="⚡"
              name="Contractors"
              count="Electrical, plumbing, HVAC"
            />
            <ProfessionCard
              icon="📋"
              name="Insurance Adjusters"
              count="State CE requirements"
            />
            <ProfessionCard
              icon="✂️"
              name="Cosmetologists"
              count="Continuing education & licensing"
            />
            <ProfessionCard
              icon="🏥"
              name="Healthcare Professionals"
              count="CME & nursing CE"
            />
          </div>
        </div>
      </section>

      {/* ── 9. PRICING ─────────────────────────────────────────────────────── */}
      <section className="bg-[#F5F5F7] px-5 py-24">
        <div className="mx-auto max-w-[1100px] text-center">
          <h2
            className="mb-3 text-[36px] font-bold text-[#1D1D1F] md:text-[44px]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Simple pricing. No surprises.
          </h2>
          <p className="mx-auto mb-14 max-w-md text-[17px] text-[#6E6E73]">
            Start free. Upgrade when you&apos;re ready.
          </p>
          <div className="mx-auto flex max-w-2xl flex-col gap-5 sm:flex-row">
            {/* Free */}
            <div className="flex flex-1 flex-col rounded-[20px] border border-[#D2D2D7] bg-white p-8 text-left">
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
            <div className="flex flex-1 flex-col rounded-[20px] border-2 border-[#0071E3] bg-white p-8 text-left">
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

      {/* ── 10. FINAL CTA ──────────────────────────────────────────────────── */}
      <section className="bg-[#1D1D1F] px-5 py-24 text-center">
        <div className="mx-auto max-w-[1100px]">
          <h2
            className="mx-auto mb-5 max-w-xl text-[36px] font-bold leading-[1.05] text-white md:text-[52px]"
            style={{ letterSpacing: "-0.03em" }}
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
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#0071E3] px-8 text-[15px] font-medium text-white transition-all hover:bg-[#0077ED] hover:scale-[1.02]"
          >
            Get started free →
          </Link>
          <p className="mt-4 text-[13px] text-[#6E6E73]">No credit card required</p>
        </div>
      </section>

      {/* ── 11. DENSE FOOTER ───────────────────────────────────────────────── */}
      <footer className="bg-[#F5F5F7] px-5 py-16 border-t border-[#E5E5EA]">
        <div className="mx-auto max-w-[1100px]">
          {/* Logo + tagline */}
          <div className="mb-12 flex items-center gap-3">
            <Image
              src="/brand/logo-light.svg"
              alt="Guidian"
              width={100}
              height={18}
            />
            <span className="text-[13px] text-[#6E6E73]">
              From first lesson to final credential.
            </span>
          </div>

          {/* Columns */}
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5 md:gap-10 mb-12">
            <div>
              <h4 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1D1D1F]">
                For Professionals
              </h4>
              <ul className="space-y-2.5">
                {[
                  "Home Inspectors",
                  "Real Estate Agents",
                  "Insurance Adjusters",
                  "Contractors",
                  "Mortgage Brokers",
                  "Cosmetologists",
                ].map((l) => (
                  <li key={l}>
                    <Link
                      href="/courses"
                      className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1D1D1F]">
                Resources
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Course Catalog", href: "/courses" },
                  { label: "State Requirements", href: "/courses" },
                  { label: "CE Calculator", href: "/courses" },
                  { label: "Blog", href: "/courses" },
                  { label: "Exam Prep Guides", href: "/courses" },
                ].map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1D1D1F]">
                Company
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: "About Guidian", href: "/" },
                  { label: "Careers", href: "/" },
                  { label: "Press", href: "/" },
                  { label: "Partners", href: "/" },
                ].map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1D1D1F]">
                Trust
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Security", href: "/" },
                  { label: "Compliance", href: "/" },
                  { label: "Status", href: "https://guidian.io/status" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                ].map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#1D1D1F]">
                Support
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Help Center", href: "/" },
                  {
                    label: "Contact",
                    href: "mailto:compliance@guidian.io",
                  },
                  {
                    label: "API Docs",
                    href: "https://guidian-api.onrender.com/docs",
                  },
                ].map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col items-start gap-4 border-t border-[#E5E5EA] pt-8 md:flex-row md:items-center md:justify-between">
            <p className="text-[12px] text-[#A1A1A6]">
              © 2026 Guidian Learning Inc. · Made in the USA
            </p>
            <div className="flex gap-5">
              {[
                { label: "𝕏", title: "Twitter / X" },
                { label: "in", title: "LinkedIn" },
                { label: "▶", title: "YouTube" },
              ].map(({ label, title }) => (
                <span
                  key={title}
                  title={title}
                  className="text-[14px] text-[#A1A1A6] hover:text-[#1D1D1F] cursor-pointer transition-colors font-mono select-none"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
