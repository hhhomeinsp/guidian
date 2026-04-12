import type { LearningStyle, Lesson } from "@/lib/api/schema";

/**
 * Variant picker. Given the learner's preferred style and the lesson's supported
 * `style_tags`, choose the variant to render. Falls back through a preference
 * hierarchy so every lesson renders something even if the preferred style isn't
 * supported.
 */
const FALLBACK: Record<LearningStyle, LearningStyle[]> = {
  visual: ["visual", "read", "kinesthetic", "auditory"],
  auditory: ["auditory", "read", "visual", "kinesthetic"],
  read: ["read", "visual", "kinesthetic", "auditory"],
  kinesthetic: ["kinesthetic", "visual", "read", "auditory"],
};

export function pickVariant(lesson: Lesson, preferred: LearningStyle): LearningStyle {
  const supported = new Set<LearningStyle>(lesson.style_tags.length ? lesson.style_tags : ["read"]);
  for (const candidate of FALLBACK[preferred]) {
    if (supported.has(candidate)) return candidate;
  }
  return "read";
}

/**
 * Lightweight behavioral-signal summary used to nudge the learner's preferred
 * style over time. The adaptive renderer calls this on variant switches and
 * significant dwell-time events; in production the server-side engine uses
 * these to update the pgvector style vector.
 */
export interface BehavioralDelta {
  variant: LearningStyle;
  seconds: number;
  event: "dwell" | "switch" | "replay";
}
