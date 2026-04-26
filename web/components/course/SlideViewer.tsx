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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlideViewerProps {
  lesson: {
    title: string;
    objectives: string[];
    mdx_content: string;
    image_url?: string | null;
    clock_minutes?: number;
  };
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

/**
 * Pure function — parses a subset of markdown into React nodes.
 * Handles: ### headings, > blockquotes, - /* bullet lists, **bold**, paragraphs.
 */
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

    // ### subheading
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

    // > blockquote callout
    if (/^>\s?/.test(line)) {
      nodes.push(
        <blockquote
          key={i}
          className="my-3 rounded-r-lg border-l-4 border-primary bg-primary/5 px-4 py-3 italic text-foreground/80"
        >
          {renderInline(line.replace(/^>\s?/, ""))}
        </blockquote>,
      );
      i++;
      continue;
    }

    // Bullet list — group consecutive items
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

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph
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
  // Split on lines that start with "## " (may be mid-string after a newline)
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
      // Content before the first ## (treat as intro with no heading)
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
      {/* Hero background */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary/40" />
      )}
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-transparent" />

      {/* Clock badge */}
      {clockMinutes != null && clockMinutes > 0 && (
        <div className="absolute right-6 top-6 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white/90 backdrop-blur-sm">
          <Clock className="h-3.5 w-3.5" />
          <span>{clockMinutes} min</span>
        </div>
      )}

      {/* Content */}
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
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
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
            Start <ArrowRight className="ml-2 h-4 w-4" />
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
}: {
  heading: string;
  body: string;
  slideNumber: number;
  totalSlides: number;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Colored header bar */}
      <div className="bg-gradient-to-r from-primary to-primary/80 px-8 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white md:text-2xl">{heading}</h2>
          <span className="text-sm font-medium text-white/70">
            {slideNumber} / {totalSlides}
          </span>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
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
        <CheckCircle2 className="h-10 w-10 text-primary" />
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
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
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
          Take Quiz <ArrowRight className="ml-2 h-5 w-5" />
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
  // Show at most 9 dots; beyond that collapse to just a counter
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
// Main SlideViewer
// ---------------------------------------------------------------------------

export function SlideViewer({ lesson, onComplete, onBack }: SlideViewerProps) {
  const sections = React.useMemo(() => parseSections(lesson.mdx_content), [lesson.mdx_content]);

  // Build slide list: [title, ...content, summary]
  const totalSlides = sections.length + 2; // +2 for title + summary
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [direction, setDirection] = React.useState(1); // 1 = forward, -1 = backward

  // Touch tracking
  const touchStartX = React.useRef<number>(0);

  const goTo = React.useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(totalSlides - 1, idx));
      setDirection(clamped > currentSlide ? 1 : -1);
      setCurrentSlide(clamped);
    },
    [currentSlide, totalSlides],
  );

  const goNext = React.useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);
  const goPrev = React.useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);

  // Keyboard navigation
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Touch/swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      if (delta < 0) goNext(); // swipe left → next
      else goPrev(); // swipe right → prev
    }
  };

  const isTitleSlide = currentSlide === 0;
  const isSummarySlide = currentSlide === totalSlides - 1;
  const isContentSlide = !isTitleSlide && !isSummarySlide;

  const contentSectionIndex = currentSlide - 1; // 0-based index into sections[]

  return (
    <div
      className="relative h-[calc(100vh-3.5rem)] overflow-hidden bg-background"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide counter (top-right, hidden on title slide where it would clash) */}
      {!isTitleSlide && (
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          {onBack && currentSlide === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
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
              imageUrl={lesson.image_url}
              clockMinutes={lesson.clock_minutes}
              onNext={goNext}
            />
          )}

          {isContentSlide && sections[contentSectionIndex] && (
            <ContentSlide
              heading={sections[contentSectionIndex].heading}
              body={sections[contentSectionIndex].body}
              slideNumber={currentSlide}
              totalSlides={totalSlides - 2} // exclude title + summary
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
            "bg-background/70 text-foreground shadow-md backdrop-blur-sm",
            "hover:bg-background hover:shadow-lg",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Right arrow */}
      {currentSlide < totalSlides - 1 && !isTitleSlide && (
        <button
          aria-label="Next slide"
          onClick={goNext}
          className={cn(
            "absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full p-2 transition-all",
            "bg-background/70 text-foreground shadow-md backdrop-blur-sm",
            "hover:bg-background hover:shadow-lg",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Dot indicators (bottom center) */}
      <div className="absolute bottom-5 left-0 right-0 z-20 flex justify-center">
        <DotIndicators
          total={totalSlides}
          current={currentSlide}
          onDotClick={(idx) => goTo(idx)}
        />
      </div>
    </div>
  );
}
