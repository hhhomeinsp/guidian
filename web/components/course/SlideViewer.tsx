"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlideViewerProps {
  className?: string;
  lesson: {
    title: string;
    objectives: string[];
    mdx_content: string;
    image_url?: string | null;
    audio_url?: string | null;
    clock_minutes?: number;
    transcript?: string | null;
    slide_audio_keys?: string[] | null;
  };
  lessonId: string;
  onComplete: () => void;
  onBack?: () => void;
}

interface ParsedSection {
  heading: string;
  body: string;
}

// ---------------------------------------------------------------------------
// MDX body renderer
// ---------------------------------------------------------------------------

function renderMdxBody(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (raw: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = re.exec(raw))) {
      if (m.index > last) parts.push(raw.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) {
        parts.push(
          <strong key={k++} className="font-semibold text-primary">
            {tok.slice(2, -2)}
          </strong>,
        );
      } else if (tok.startsWith("`")) {
        parts.push(
          <code
            key={k++}
            className="rounded bg-muted px-1 py-0.5 font-mono text-sm"
          >
            {tok.slice(1, -1)}
          </code>,
        );
      } else {
        parts.push(<em key={k++}>{tok.slice(1, -1)}</em>);
      }
      last = m.index + tok.length;
    }
    if (last < raw.length) parts.push(raw.slice(last));
    return parts.length === 1 ? parts[0] : parts;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^###\s/.test(line)) {
      nodes.push(
        <h3
          key={i}
          className="mb-2 mt-4 text-lg font-semibold text-foreground first:mt-0"
        >
          {renderInline(line.replace(/^###\s/, ""))}
        </h3>,
      );
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const content = line.replace(/^>\s*/, "");
      const isWarning = /^[⚠️🚨]|^Warning|^CAUTION/i.test(content);
      const isTip = /^[💡✅]|^Tip|^Note/i.test(content);
      const borderColor = isWarning
        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
        : isTip
          ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
          : "border-slate-400 bg-slate-50 dark:bg-slate-900/30";
      nodes.push(
        <div
          key={i}
          className={`my-3 rounded-r-lg border-l-4 ${borderColor} px-4 py-3 text-sm leading-relaxed`}
        >
          {renderInline(content)}
        </div>,
      );
      i++;
      continue;
    }

    if (/^\|/.test(line.trim())) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.filter(l => !/^\|[-:\s|]+\|?$/.test(l.trim()));
      if (rows.length === 0) continue;
      const parseRow = (l: string) =>
        l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const headers = parseRow(rows[0]);
      const body = rows.slice(1);
      nodes.push(
        <div key={`tbl-${i}`} className="my-4 w-full overflow-x-auto rounded-lg border border-cloud">
          <table className="w-full min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-secondary text-white">
                {headers.map((h, j) => (
                  <th key={j} className="px-4 py-2.5 text-left text-xs font-semibold tracking-wider">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => {
                const cells = parseRow(row);
                return (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-fog'}>
                    {cells.map((cell, ci) => (
                      <td key={ci} className="px-4 py-2.5 leading-relaxed text-foreground/90 border-t border-cloud">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-3 space-y-1.5">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-base leading-relaxed text-foreground/90">
                {renderInline(item)}
              </span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const steps: string[] = [];
      const startI = i;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        steps.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <div key={`steps-${startI}`} className="my-4 space-y-2">
          {steps.map((text, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground mt-0.5">
                {idx + 1}
              </span>
              <span className="text-base leading-relaxed">{renderInline(text)}</span>
            </div>
          ))}
        </div>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (/^\*\*[^*]+\*\*\.?$/.test(line.trim())) {
      const text = line.trim().replace(/^\*\*/, "").replace(/\*\*\.?$/, "");
      nodes.push(
        <div key={i} className="my-4 border-l-4 border-primary bg-primary/5 px-4 py-3 rounded-r-lg">
          <p className="text-lg font-semibold text-foreground">{text}</p>
        </div>,
      );
      i++;
      continue;
    }

    if (line.trim().length > 140 && line.includes(". ")) {
      const sentences = line.trim().split(/\.\s+/).map((s, i, arr) => i < arr.length - 1 ? s + '.' : s).filter(s => s.trim().length > 0);
      if (sentences.length >= 3) {
        nodes.push(
          <ul key={`auto-ul-${i}`} className="my-3 space-y-2">
            {sentences.map((s, j) => (
              <li key={j} className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-base leading-relaxed text-foreground/90">{renderInline(s.trim())}</span>
              </li>
            ))}
          </ul>
        );
        i++;
        continue;
      }
    }
    nodes.push(
      <p key={i} className="text-base leading-relaxed text-foreground/90 [&+p]:mt-3">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return <>{nodes}</>;
}

// ---------------------------------------------------------------------------
// Slide parsing
// ---------------------------------------------------------------------------

function parseSections(mdxContent: string): ParsedSection[] {
  const raw = mdxContent.split(/\n(?=## )/);
  const sections: ParsedSection[] = [];

  for (const chunk of raw) {
    const lines = chunk.split("\n");
    const firstLine = lines[0].trim();
    if (firstLine.startsWith("## ")) {
      sections.push({
        heading: firstLine.replace(/^##\s+/, ""),
        body: lines.slice(1).join("\n").trim(),
      });
    } else if (firstLine !== "") {
      sections.push({
        heading: "",
        body: chunk.trim(),
      });
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : "100%",
    opacity: 0,
  }),
};

const transition = { duration: 0.3, ease: "easeInOut" as const };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TitleSlide({
  title,
  objectives,
  imageUrl,
  clockMinutes,
  onNext,
}: {
  title: string;
  objectives: string[];
  imageUrl?: string | null;
  clockMinutes?: number;
  onNext: () => void;
}) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/90 via-secondary/70 to-secondary/40" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-transparent" />

      {clockMinutes != null && clockMinutes > 0 && (
        <div className="absolute right-6 top-6 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white/90 backdrop-blur-sm">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          <span>{clockMinutes} min</span>
        </div>
      )}

      <div className="relative z-10 flex max-w-2xl flex-col items-center gap-6 px-8 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-4xl font-bold leading-tight text-white"
        >
          {title}
        </motion.h1>

        {objectives.length > 0 && (
          <motion.ul
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.12, delayChildren: 0.35 } },
              hidden: {},
            }}
            className="space-y-2 text-left"
          >
            {objectives.map((obj, idx) => (
              <motion.li
                key={idx}
                variants={{
                  hidden: { opacity: 0, x: -16 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
                }}
                className="flex items-start gap-2 text-white/80"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/70" aria-hidden />
                <span className="text-sm leading-snug">{obj}</span>
              </motion.li>
            ))}
          </motion.ul>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.35 }}
        >
          <Button
            onClick={onNext}
            className="rounded-full bg-white px-8 py-3 text-base font-semibold text-primary shadow-lg hover:bg-white/90"
          >
            Start <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function ContentSlide({
  heading,
  body,
  slideNumber,
  totalSlides,
  onTap,
  hasAudio,
  audioPlaying,
  audioPct,
  onAudioToggle,
}: {
  heading: string;
  body: string;
  slideNumber: number;
  totalSlides: number;
  onTap?: (e: React.MouseEvent) => void;
  hasAudio?: boolean;
  audioPlaying?: boolean;
  audioPct?: number;
  onAudioToggle?: () => void;
}) {
  const bodyRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [heading]);

  return (
    <div
      className="flex h-full w-full flex-col"
      aria-label={`Slide ${slideNumber} of ${totalSlides}: ${heading}`}
    >
      {/* Sticky slide header */}
      <div className="shrink-0 bg-white border-b border-[#D2D2D7] px-6 py-4">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center self-start rounded-full bg-[#E8F0FE] px-2.5 py-0.5 text-xs font-medium text-[#0071E3]">
            {slideNumber} of {totalSlides}
          </span>
          <h2
            className="text-lg font-semibold leading-snug text-[#1D1D1F] md:text-xl"
            aria-live="polite"
          >
            {heading}
          </h2>
        </div>

        {/* Per-slide audio controls */}
        {hasAudio && (
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onAudioToggle?.(); }}
              aria-label={audioPlaying ? "Pause audio" : "Play audio"}
              className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#0071E3] text-white hover:bg-[#0077ED] active:scale-95 transition-transform"
            >
              {audioPlaying
                ? <Pause className="h-3 w-3" aria-hidden />
                : <Play className="h-3 w-3 translate-x-px" aria-hidden />}
            </button>
            <div className="flex-1 h-1 rounded-full bg-[#D2D2D7] overflow-hidden">
              <div
                className="h-full bg-[#0071E3] rounded-full transition-all duration-300"
                style={{ width: `${audioPct ?? 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-6 pb-20 md:px-8" onClick={onTap}>
        {renderMdxBody(body)}
      </div>
    </div>
  );
}

function SummarySlide({
  objectives,
  onComplete,
}: {
  objectives: string[];
  onComplete: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-8 py-10">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
      >
        <CheckCircle2 className="h-10 w-10 text-primary" aria-hidden />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6 text-center text-2xl font-bold text-foreground"
      >
        Ready for the Knowledge Check?
      </motion.h2>

      {objectives.length > 0 && (
        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1, delayChildren: 0.35 } },
            hidden: {},
          }}
          className="mb-8 w-full max-w-md space-y-2"
        >
          {objectives.map((obj, idx) => (
            <motion.li
              key={idx}
              variants={{
                hidden: { opacity: 0, x: -12 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.35 } },
              }}
              className="flex items-start gap-2.5"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="text-sm text-foreground/80">{obj}</span>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          onClick={onComplete}
          size="lg"
          className="rounded-full px-10 py-4 text-base font-semibold"
        >
          Take Quiz <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
        </Button>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dot indicators
// ---------------------------------------------------------------------------

function DotIndicators({
  total,
  current,
  onDotClick,
}: {
  total: number;
  current: number;
  onDotClick: (idx: number) => void;
}) {
  const MAX_DOTS = 9;
  if (total > MAX_DOTS) return null;

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, idx) => (
        <button
          key={idx}
          aria-label={`Go to slide ${idx + 1}`}
          onClick={() => onDotClick(idx)}
          className={cn(
            "rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            idx === current
              ? "h-2.5 w-6 bg-primary"
              : "h-2 w-2 bg-muted-foreground/40 hover:bg-muted-foreground/70",
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inactivity modal
// ---------------------------------------------------------------------------

function InactivityModal({
  variant,
  onResume,
}: {
  variant: "warn" | "paused";
  onResume: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-title"
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="mx-4 max-w-sm rounded-2xl bg-white p-8 shadow-xl text-center">
        <Clock className="mx-auto mb-4 h-10 w-10 text-[#FF9F0A]" aria-hidden />
        <h3 id="inactivity-title" className="mb-2 text-xl font-bold text-foreground">
          {variant === "warn" ? "Still there?" : "Session paused"}
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">
          {variant === "warn"
            ? "Your session will pause in 5 minutes to comply with seat-time requirements."
            : "Resume when ready."}
        </p>
        <Button onClick={onResume} className="w-full rounded-full">
          Resume
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SlideViewer
// ---------------------------------------------------------------------------

const INACTIVITY_WARN_MS = 30 * 60 * 1000;  // 30 min
const INACTIVITY_PAUSE_MS = 35 * 60 * 1000; // 35 min (30 + 5)
const INACTIVITY_POLL_MS = 60 * 1000;        // check every 1 min

export function SlideViewer({ lesson, lessonId, onComplete, onBack, className }: SlideViewerProps) {
  const sections = React.useMemo(() => parseSections(lesson.mdx_content), [lesson.mdx_content]);

  // ---------------------------------------------------------------------------
  // Per-slide audio
  // ---------------------------------------------------------------------------
  const [slideAudioUrls, setSlideAudioUrls] = React.useState<(string | null)[]>([]);
  const [presignedImageUrl, setPresignedImageUrl] = React.useState<string | null>(null);

  // Fetch presigned image URL for title slide
  React.useEffect(() => {
    if (!lesson.image_url) return;
    fetch(`${API_BASE_URL}/courses/lessons/${lessonId}/image-url`)
      .then(r => r.json())
      .then(d => setPresignedImageUrl(d.url ?? null))
      .catch(() => {});
  }, [lessonId, lesson.image_url]);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [audioPlaying, setAudioPlaying] = React.useState(false);
  const [audioPct, setAudioPct] = React.useState(0);

  // Fetch presigned slide URLs once on mount (only if slide audio keys exist)
  React.useEffect(() => {
    if (!lesson.slide_audio_keys?.length) return;
    fetch(`${API_BASE_URL}/courses/lessons/${lessonId}/slides/audio`)
      .then(r => r.json())
      .then(d => setSlideAudioUrls(d.slide_audio_urls ?? []));
  }, [lessonId, lesson.slide_audio_keys?.length]);

  // Wire up audio element event listeners (stable — runs once)
  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime  = () => setAudioPct(a.duration > 0 ? (a.currentTime / a.duration) * 100 : 0);
    const onPlay  = () => setAudioPlaying(true);
    const onPause = () => setAudioPlaying(false);
    const onEnd   = () => setAudioPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play",       onPlay);
    a.addEventListener("pause",      onPause);
    a.addEventListener("ended",      onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play",       onPlay);
      a.removeEventListener("pause",      onPause);
      a.removeEventListener("ended",      onEnd);
    };
  }, []);

  const toggleAudio = React.useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  }, []);

  // ---------------------------------------------------------------------------
  // Inactivity tracking
  // ---------------------------------------------------------------------------
  const lastActiveRef = React.useRef<number>(Date.now());
  const [inactivityState, setInactivityState] = React.useState<"active" | "warn" | "paused">("active");

  const resetActivity = React.useCallback(() => {
    lastActiveRef.current = Date.now();
    setInactivityState("active");
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => {
      const idle = Date.now() - lastActiveRef.current;
      if (idle >= INACTIVITY_PAUSE_MS) {
        setInactivityState("paused");
        if (!audioRef.current?.paused) audioRef.current?.pause();
      } else if (idle >= INACTIVITY_WARN_MS) {
        setInactivityState(prev => prev === "active" ? "warn" : prev);
      }
    }, INACTIVITY_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const handleContentTap = React.useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea')) return;
    if (slideAudioUrls.length > 0) toggleAudio();
  }, [slideAudioUrls.length, toggleAudio]);

  // ---------------------------------------------------------------------------
  // Slide navigation
  // ---------------------------------------------------------------------------
  const totalSlides = sections.length + 2;
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [direction, setDirection] = React.useState(1);

  const touchStartX = React.useRef<number>(0);

  const goTo = React.useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(totalSlides - 1, idx));
      setDirection(clamped > currentSlide ? 1 : -1);
      setCurrentSlide(clamped);
      resetActivity();
    },
    [currentSlide, totalSlides, resetActivity],
  );

  const goNext = React.useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);
  const goPrev = React.useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);

  // Update audio src when slide changes — stop previous, start new
  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setAudioPlaying(false);
    setAudioPct(0);
    const url = slideAudioUrls[currentSlide] ?? null;
    if (url) {
      a.src = url;
      a.load();
      a.play().catch(() => {});
    } else {
      a.src = "";
    }
  }, [currentSlide, slideAudioUrls]);

  // Keyboard navigation
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      resetActivity();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, resetActivity]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    resetActivity();
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      if (delta < 0) goNext();
      else goPrev();
    }
  };

  const isTitleSlide = currentSlide === 0;
  const isSummarySlide = currentSlide === totalSlides - 1;
  const isContentSlide = !isTitleSlide && !isSummarySlide;

  const contentSectionIndex = currentSlide - 1;
  const currentSlideHasAudio = Boolean(slideAudioUrls[currentSlide]);

  return (
    <div
      className={cn("flex flex-col h-full", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseMove={resetActivity}
    >
      {/* Hidden shared audio element */}
      <audio ref={audioRef} preload="auto" className="hidden" />

      {/* Skip link */}
      <a
        href="#slide-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-white focus:text-sm"
      >
        Skip to content
      </a>

      {/* Thin progress bar */}
      <div className="shrink-0 h-1 w-full bg-muted" role="progressbar" aria-valuenow={currentSlide + 1} aria-valuemin={1} aria-valuemax={totalSlides} aria-label="Lesson progress">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
        />
      </div>

      {/* Slide area */}
      <div id="slide-content" className="flex-1 overflow-hidden relative bg-background" role="main">

        {!isTitleSlide && (
          <div className="absolute right-4 top-4 z-20 hidden items-center gap-2 md:flex">
            {onBack && currentSlide === 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-muted-foreground"
                aria-label="Go back"
              >
                <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Back
              </Button>
            )}
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {currentSlide + 1} / {totalSlides}
            </span>
          </div>
        )}

        {/* Animated slide area */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="absolute inset-0"
          >
            {isTitleSlide && (
              <TitleSlide
                title={lesson.title}
                objectives={lesson.objectives}
                imageUrl={presignedImageUrl}
                clockMinutes={lesson.clock_minutes}
                onNext={goNext}
              />
            )}

            {isContentSlide && sections[contentSectionIndex] && (
              <ContentSlide
                heading={sections[contentSectionIndex].heading}
                body={sections[contentSectionIndex].body}
                slideNumber={currentSlide}
                totalSlides={totalSlides - 2}
                onTap={handleContentTap}
                hasAudio={currentSlideHasAudio}
                audioPlaying={audioPlaying}
                audioPct={audioPct}
                onAudioToggle={toggleAudio}
              />
            )}

            {isSummarySlide && (
              <SummarySlide objectives={lesson.objectives} onComplete={onComplete} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Left arrow */}
        {currentSlide > 0 && (
          <button
            aria-label="Previous slide"
            onClick={goPrev}
            className={cn(
              "absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full p-2 transition-all",
              "hidden md:flex",
              "bg-background/70 text-foreground shadow-md backdrop-blur-sm",
              "hover:bg-background hover:shadow-lg",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        )}

        {/* Right arrow */}
        {currentSlide < totalSlides - 1 && !isTitleSlide && (
          <button
            aria-label="Next slide"
            onClick={goNext}
            className={cn(
              "absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full p-2 transition-all",
              "hidden md:flex",
              "bg-background/70 text-foreground shadow-md backdrop-blur-sm",
              "hover:bg-background hover:shadow-lg",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <ChevronRight className="h-6 w-6" aria-hidden />
          </button>
        )}

        {/* Dot indicators */}
        <div className="absolute bottom-5 left-0 right-0 z-20 hidden md:flex justify-center">
          <DotIndicators
            total={totalSlides}
            current={currentSlide}
            onDotClick={(idx) => goTo(idx)}
          />
        </div>

        {/* Mobile bottom nav bar */}
        <nav
          role="navigation"
          aria-label="Slide navigation"
          className="absolute bottom-0 left-0 right-0 z-20 flex md:hidden items-center justify-between border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm"
        >
          <button
            onClick={goPrev}
            disabled={currentSlide === 0}
            aria-label="Previous slide"
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-foreground disabled:opacity-30 active:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
          </button>
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase" aria-hidden>
            {currentSlide + 1} / {totalSlides}
          </span>
          <button
            onClick={goNext}
            disabled={currentSlide >= totalSlides - 1}
            aria-label="Next slide"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-30 active:bg-primary/80"
          >
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </nav>

        {/* Inactivity modal */}
        {inactivityState !== "active" && (
          <InactivityModal
            variant={inactivityState}
            onResume={resetActivity}
          />
        )}
      </div>
    </div>
  );
}
