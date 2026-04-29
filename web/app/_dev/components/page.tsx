"use client";

import * as React from "react";
import {
  AudioPlayer,
  Callout,
  Certificate,
  Checklist,
  ContentBlock,
  Diagram,
  Flashcard,
  LessonPage,
  ProgressCheck,
  Quiz,
  Scenario,
  VideoEmbed,
  fixtureLesson,
} from "@/components/course";

export default function ComponentSandbox() {
  return (
    <div className="container space-y-16 py-12">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Guidian Component Library</h1>
        <p className="text-muted-foreground">
          Dev-only sandbox exercising every component in <code>components/course/</code> with
          fixture data. Used for visual smoke testing before the course player is wired up.
        </p>
      </header>

      <Section title="LessonPage (master wrapper)">
        <LessonPage
          lesson={fixtureLesson}
          moduleTitle="Module 1 · Privacy Foundations"
          progressPct={35}
          onNext={() => {}}
          onPrev={() => {}}
        >
          <ContentBlock markdown={fixtureLesson.mdx_content} />
        </LessonPage>
      </Section>

      <Section title="ContentBlock (MDX)">
        <ContentBlock markdown={fixtureLesson.mdx_content} />
      </Section>

      <Section title="Quiz">
        <Quiz quiz={fixtureLesson.quiz} onSubmit={(r) => console.log("quiz result", r)} />
      </Section>

      <Section title="Scenario">
        <Scenario
          startId="n1"
          nodes={[
            {
              id: "n1",
              prompt:
                "A patient asks you to email their lab results to a family member. What do you do?",
              choices: [
                { label: "Send them immediately", nextId: "n2a" },
                { label: "Verify written authorization first", nextId: "n2b" },
              ],
            },
            {
              id: "n2a",
              prompt: "",
              terminal: { outcome: "failure", mesnova: "Unauthorized disclosure of PHI." },
            },
            {
              id: "n2b",
              prompt: "The patient signs a release form specifying the family member.",
              choices: [{ label: "Send via secure portal", nextId: "end" }],
            },
            {
              id: "end",
              prompt: "",
              terminal: {
                outcome: "success",
                mesnova: "Correct: authorized, minimum necessary, secure channel.",
              },
            },
          ]}
        />
      </Section>

      <Section title="Flashcard deck">
        <Flashcard
          cards={[
            { id: "c1", front: "What is PHI?", back: "Protected Health Information." },
            {
              id: "c2",
              front: "Define 'minimum necessary'.",
              back: "Use/disclose only the minimum PHI required for the purpose.",
            },
          ]}
        />
      </Section>

      <Section title="Diagram (Mermaid)">
        <Diagram mermaid={fixtureLesson.diagrams[0].mermaid} />
      </Section>

      <Section title="VideoEmbed">
        <VideoEmbed src="https://www.youtube.com/embed/dQw4w9WgXcQ" />
      </Section>

      <Section title="AudioPlayer">
        <AudioPlayer src={null} title="HIPAA Foundations — narrated" />
      </Section>

      <Section title="Callout variants">
        <div className="space-y-2">
          <Callout variant="tip">Remember the minimum necessary standard.</Callout>
          <Callout variant="warning">Unauthorized disclosure is a reportable incident.</Callout>
          <Callout variant="important">State laws may add stricter requirements.</Callout>
          <Callout variant="note">PHI includes oral, written, and electronic forms.</Callout>
        </div>
      </Section>

      <Section title="ProgressCheck">
        <div className="space-y-2">
          <ProgressCheck status="complete" label="Module 1 complete" ceuHours={0.25} />
          <ProgressCheck status="in_progress" label="Module 2 in progress" ceuHours={0.5} />
          <ProgressCheck status="pending" label="Module 3 — final assessment" ceuHours={0.25} />
        </div>
      </Section>

      <Section title="Certificate">
        <Certificate
          learnerName="Dana Rivera, RN"
          courseTitle="HIPAA Privacy Rule Refresher"
          ceuHours={1.0}
          issuedAt={new Date().toISOString()}
          verificationCode="GD-4B7F-9E2A"
          accreditingBody="ANCC"
        />
      </Section>

      <Section title="Checklist">
        <Checklist
          items={[
            { id: "a", label: "Read all module content" },
            { id: "b", label: "Complete quiz with passing score" },
            { id: "c", label: "Acknowledge compliance attestation" },
            { id: "d", label: "Download certificate", required: false },
          ]}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-2 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
