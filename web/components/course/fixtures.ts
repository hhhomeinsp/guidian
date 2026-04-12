import type { Lesson, QuizPayload, Diagram } from "@/lib/api/schema";

export const fixtureDiagram: Diagram = {
  id: "d1",
  mermaid: `flowchart LR
  A[Patient Intake] --> B{Consent Obtained?}
  B -- Yes --> C[Share PHI with Care Team]
  B -- No --> D[Pause & Document]
  C --> E[Audit Log]`,
};

export const fixtureQuiz: QuizPayload = {
  questions: [
    {
      id: "q1",
      type: "single_choice",
      prompt: "Under HIPAA, who is a 'covered entity'?",
      choices: [
        "Any business that handles data",
        "Health plans, clearinghouses, and certain providers",
        "Only hospitals",
        "Only insurance companies",
      ],
      correct: 1,
      explanation:
        "Covered entities are health plans, healthcare clearinghouses, and healthcare providers who transmit health information electronically.",
    },
    {
      id: "q2",
      type: "true_false",
      prompt: "PHI may be shared freely for marketing purposes without authorization.",
      choices: ["True", "False"],
      correct: false,
      explanation: "Marketing use of PHI generally requires written authorization.",
    },
  ],
};

export const fixtureLesson: Lesson = {
  id: "00000000-0000-0000-0000-000000000001",
  module_id: "00000000-0000-0000-0000-000000000010",
  title: "HIPAA Privacy Rule: Foundations",
  order_index: 0,
  objectives: [
    "Identify covered entities and business associates",
    "Recognize permitted uses and disclosures of PHI",
    "Apply the minimum necessary standard",
  ],
  mdx_content: `The **HIPAA Privacy Rule** establishes national standards to protect individuals' medical records and other individually identifiable health information.

It applies to health plans, healthcare clearinghouses, and those healthcare providers that conduct certain healthcare transactions electronically.

Key concepts:

- **PHI** — Protected Health Information
- **Covered Entity** — organizations bound by the rule
- **Minimum Necessary** — use or disclose only what is needed

> Always document the rationale for any disclosure of PHI.`,
  audio_url: null,
  diagrams: [fixtureDiagram],
  quiz: fixtureQuiz,
  style_tags: ["read", "visual", "auditory", "kinesthetic"],
  clock_minutes: 12,
  requires_completion: true,
  version: 1,
};
