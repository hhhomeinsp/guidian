import type { LearningStyle } from "@/lib/api/schema";

/**
 * VARK-inspired onboarding inventory. 8 questions × 4 options. Each option
 * maps to exactly one learning style. The backend tallies answers into
 * normalized scores and seeds the base_preference dims of the learner's
 * style vector.
 *
 * NOT the canonical VARK questionnaire — that instrument is copyrighted.
 * These are original compliance-adjacent scenarios written for Guidian.
 */
export interface VARKOption {
  label: string;
  style: LearningStyle;
}

export interface VARKQuestion {
  id: string;
  prompt: string;
  options: VARKOption[];
}

export const VARK_QUESTIONS: VARKQuestion[] = [
  {
    id: "q1",
    prompt: "You need to learn a new workflow at work. You prefer to:",
    options: [
      { style: "visual", label: "See a flowchart of the steps" },
      { style: "auditory", label: "Have a colleague walk through it out loud" },
      { style: "read", label: "Read a written procedure document" },
      { style: "kinesthetic", label: "Try it hands-on with a checklist" },
    ],
  },
  {
    id: "q2",
    prompt: "When you remember training content, you most often recall:",
    options: [
      { style: "visual", label: "Diagrams and images you saw" },
      { style: "auditory", label: "What the instructor said" },
      { style: "read", label: "The wording in the slides or handout" },
      { style: "kinesthetic", label: "The exercises you completed" },
    ],
  },
  {
    id: "q3",
    prompt: "You're preparing for a compliance audit. You would:",
    options: [
      { style: "visual", label: "Map the controls to a big picture view" },
      { style: "auditory", label: "Discuss each control with teammates" },
      { style: "read", label: "Re-read the policy documents carefully" },
      { style: "kinesthetic", label: "Run through a mock audit scenario" },
    ],
  },
  {
    id: "q4",
    prompt: "A new regulation is released. Your first move is to:",
    options: [
      { style: "read", label: "Read the official text end-to-end" },
      { style: "visual", label: "Find an infographic or summary chart" },
      { style: "auditory", label: "Listen to a podcast or webinar about it" },
      { style: "kinesthetic", label: "Apply it to a current case to see how it lands" },
    ],
  },
  {
    id: "q5",
    prompt: "When something is unclear in training, you prefer to:",
    options: [
      { style: "visual", label: "See it illustrated" },
      { style: "auditory", label: "Ask someone to explain it verbally" },
      { style: "read", label: "Look up the written definition" },
      { style: "kinesthetic", label: "Work through a practice example" },
    ],
  },
  {
    id: "q6",
    prompt: "You retain the most when content is delivered as:",
    options: [
      { style: "visual", label: "Diagrams and visual models" },
      { style: "auditory", label: "Narrated audio or discussion" },
      { style: "read", label: "Structured written material" },
      { style: "kinesthetic", label: "Scenarios, simulations, and role-plays" },
    ],
  },
  {
    id: "q7",
    prompt: "Explaining something to a colleague, you would most naturally:",
    options: [
      { style: "visual", label: "Sketch it on a whiteboard" },
      { style: "auditory", label: "Talk it through step-by-step" },
      { style: "read", label: "Send them a written summary" },
      { style: "kinesthetic", label: "Walk them through a live example" },
    ],
  },
  {
    id: "q8",
    prompt: "Looking back at trainings you enjoyed, the standout element was:",
    options: [
      { style: "visual", label: "Strong visual design" },
      { style: "auditory", label: "A compelling narrator" },
      { style: "read", label: "Clear, concise writing" },
      { style: "kinesthetic", label: "Meaningful hands-on practice" },
    ],
  },
];
