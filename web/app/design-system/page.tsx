"use client";

import { useState, useCallback } from "react";
import { Check, Copy, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidianLogo } from "@/components/ui/GuidianLogo";
import { cn } from "@/lib/utils";

// ── Token data ────────────────────────────────────────────────────────────────

const BRAND_COLORS = [
  { name: "--color-navy", hex: "#162D4A", label: "Navy", dark: true },
  { name: "--color-navy-deep", hex: "#0D1C2E", label: "Navy Deep", dark: true },
  { name: "--color-navy-mid", hex: "#1E3D5C", label: "Navy Mid", dark: true },
  { name: "--color-amber", hex: "#C98A2A", label: "Amber", dark: false },
  { name: "--color-amber-light", hex: "#E4A94A", label: "Amber Light", dark: false },
  { name: "--color-amber-dim", hex: "#8B5E1A", label: "Amber Dim", dark: true },
  { name: "--color-teal", hex: "#0E7C7B", label: "Teal", dark: true },
  { name: "--color-teal-light", hex: "#13A09E", label: "Teal Light", dark: true },
  { name: "--color-teal-dim", hex: "#095857", label: "Teal Dim", dark: true },
];

const NEUTRAL_COLORS = [
  { name: "--color-ink", hex: "#0D1C2B", label: "Ink", dark: true },
  { name: "--color-slate", hex: "#3D5A73", label: "Slate", dark: true },
  { name: "--color-steel", hex: "#6B8499", label: "Steel", dark: false },
  { name: "--color-mist", hex: "#B8CADA", label: "Mist", dark: false },
  { name: "--color-cloud", hex: "#DDE8F0", label: "Cloud", dark: false },
  { name: "--color-fog", hex: "#EDF2F6", label: "Fog", dark: false },
  { name: "--color-cream", hex: "#FAF7F2", label: "Cream", dark: false },
  { name: "--color-white", hex: "#FFFFFF", label: "White", dark: false },
];

const SEMANTIC_COLORS = [
  { name: "--color-success", hex: "#2A7A4A", bg: "#EAF5EE", label: "Success" },
  { name: "--color-warning", hex: "#B56A10", bg: "#FEF3E2", label: "Warning" },
  { name: "--color-error", hex: "#A53030", bg: "#FDEAEA", label: "Error" },
  { name: "--color-info", hex: "#1A5F8A", bg: "#E3EFF8", label: "Info" },
];

const JOURNEY_STAGES = [
  { key: "pre-college", label: "Pre-College", color: "#4A80B5", desc: "High school dual enrollment, AP/IB prep" },
  { key: "vocational", label: "Vocational", color: "#0E7C7B", desc: "Trade certifications, apprenticeships" },
  { key: "college", label: "College", color: "#3D5A73", desc: "Associate and bachelor degree programs" },
  { key: "certif", label: "Certification", color: "#4A7C6F", desc: "Professional certifications & credentials" },
  { key: "licensure", label: "Licensure", color: "#162D4A", desc: "State licensing exams and renewals" },
  { key: "ce", label: "Continuing Ed", color: "#C98A2A", desc: "CEU maintenance for licensed professionals" },
];

const TYPE_SCALE = [
  { name: "Display XL", classes: "text-5xl font-bold", sample: "Learning, redefined." },
  { name: "Display", classes: "text-4xl font-bold", sample: "Certified Home Inspector" },
  { name: "H1", classes: "text-3xl font-bold", sample: "Module 4: Electrical Systems" },
  { name: "H2", classes: "text-2xl font-semibold", sample: "Safety Hazards & Grounding" },
  { name: "H3", classes: "text-xl font-semibold", sample: "Arc Fault Circuit Interrupters" },
  { name: "Body", classes: "text-base font-normal", sample: "The inspector shall report all visible electrical deficiencies observed during inspection." },
  { name: "Small", classes: "text-sm font-normal", sample: "75 min · 12 sections · 4 quiz questions" },
  { name: "Label", classes: "text-xs font-medium tracking-widest uppercase", sample: "Continuing Education · 2.5 CEU Hours" },
  { name: "Mono", classes: "text-sm font-mono", sample: "course_id: 2c903510-fceb-4937-8517" },
];

const RADIUS_SCALE = [
  { name: "sm", class: "rounded-sm", px: "4px" },
  { name: "md", class: "rounded-md", px: "6px" },
  { name: "lg", class: "rounded-lg", px: "8px" },
  { name: "xl", class: "rounded-xl", px: "12px" },
  { name: "2xl", class: "rounded-2xl", px: "16px" },
  { name: "full", class: "rounded-full", px: "9999px" },
];

const CSS_VARS_OUTPUT = `/* Guidian CSS Custom Properties */
:root {
  --color-navy: #162D4A;
  --color-navy-deep: #0D1C2E;
  --color-navy-mid: #1E3D5C;
  --color-amber: #C98A2A;
  --color-amber-light: #E4A94A;
  --color-amber-dim: #8B5E1A;
  --color-teal: #0E7C7B;
  --color-teal-light: #13A09E;
  --color-teal-dim: #095857;
  --color-ink: #0D1C2B;
  --color-slate: #3D5A73;
  --color-steel: #6B8499;
  --color-mist: #B8CADA;
  --color-cloud: #DDE8F0;
  --color-fog: #EDF2F6;
  --color-cream: #FAF7F2;
  --color-success: #2A7A4A;
  --color-success-bg: #EAF5EE;
  --color-warning: #B56A10;
  --color-warning-bg: #FEF3E2;
  --color-error: #A53030;
  --color-error-bg: #FDEAEA;
  --color-info: #1A5F8A;
  --color-info-bg: #E3EFF8;
}`;

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function ColorSwatch({
  hex,
  label,
  name,
  dark,
  onCopy,
  copied,
}: {
  hex: string;
  label: string;
  name: string;
  dark?: boolean;
  onCopy: (text: string, id: string) => void;
  copied: string | null;
}) {
  const id = `color-${name}`;
  const isCopied = copied === id;
  return (
    <button
      onClick={() => onCopy(hex, id)}
      className="group flex w-full flex-col overflow-hidden rounded-lg border border-border text-left shadow-sm transition-transform hover:scale-105"
      title={`Copy ${hex}`}
    >
      <div className="relative flex h-16 w-full items-end p-2" style={{ backgroundColor: hex }}>
        <span
          className={cn(
            "text-xs font-mono opacity-0 transition-opacity group-hover:opacity-100",
            dark ? "text-white/80" : "text-black/60",
          )}
        >
          {isCopied ? (
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3" /> Copied!
            </span>
          ) : (
            hex
          )}
        </span>
      </div>
      <div className="bg-card px-2.5 py-2">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="truncate font-mono text-[10px] text-muted-foreground">{name}</p>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState("licensure");
  const [darkPreview, setDarkPreview] = useState(false);

  const copyToClipboard = useCallback(
    (text: string, id: string) => {
      navigator.clipboard
        .writeText(text)
        .catch(() => {})
        .finally(() => {
          setCopied(id);
          setTimeout(() => setCopied(null), 2000);
        });
    },
    [],
  );

  const activeStageData = JOURNEY_STAGES.find((s) => s.key === activeStage);

  return (
    <main className="min-h-screen bg-background pb-20">
      {/* Page header */}
      <div className="bg-secondary text-secondary-foreground">
        <div className="container py-10">
          <div className="flex items-center gap-4">
            <GuidianLogo size={44} strokeColor="white" accentColor="#C98A2A" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Guidian Design System</h1>
              <p className="mt-1 text-sm text-secondary-foreground/70">
                Brand tokens, components, and patterns — the visual language of Guidian.
              </p>
            </div>
          </div>
        </div>
        <div
          className="h-[3px] w-full"
          style={{ background: "linear-gradient(90deg, #C98A2A 0%, #E4A94A 50%, #C98A2A 100%)" }}
        />
      </div>

      <div className="container space-y-14 py-10">
        {/* Brand Colors */}
        <section>
          <SectionHeader
            title="Brand Colors"
            desc="Core palette: Navy, Amber, Teal — the three pillars of the Guidian brand."
          />
          {[
            { group: "Navy", filter: "navy" },
            { group: "Amber", filter: "amber" },
            { group: "Teal", filter: "teal" },
          ].map(({ group, filter }) => (
            <div key={group} className="mb-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group}
              </h3>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-9">
                {BRAND_COLORS.filter((c) => c.name.includes(filter)).map((c) => (
                  <ColorSwatch key={c.name} {...c} onCopy={copyToClipboard} copied={copied} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Neutrals */}
        <section>
          <SectionHeader
            title="Neutrals"
            desc="From deep ink to pure white — the neutral scale for text, surfaces, and borders."
          />
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {NEUTRAL_COLORS.map((c) => (
              <ColorSwatch key={c.name} {...c} onCopy={copyToClipboard} copied={copied} />
            ))}
          </div>
        </section>

        {/* Semantic */}
        <section>
          <SectionHeader
            title="Semantic Colors"
            desc="Status and feedback colors for alerts, validation, and system mesnovas."
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {SEMANTIC_COLORS.map((c) => (
              <div key={c.name} className="overflow-hidden rounded-lg border border-border">
                <div className="h-12" style={{ backgroundColor: c.hex }} />
                <div
                  className="flex h-8 items-center px-3 text-xs font-medium"
                  style={{ backgroundColor: c.bg, color: c.hex }}
                >
                  {c.label} Background
                </div>
                <div className="bg-card px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">{c.label}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section>
          <SectionHeader
            title="Typography"
            desc="Georgia serif throughout — the authoritative voice of professional education."
          />
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {TYPE_SCALE.map((t) => (
              <div
                key={t.name}
                className="flex items-baseline gap-4 bg-card px-5 py-4 transition-colors hover:bg-muted/50"
              >
                <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                  {t.name}
                </span>
                <p className={cn("leading-snug text-foreground", t.classes)}>{t.sample}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Border Radius */}
        <section>
          <SectionHeader title="Border Radius" desc="Consistent rounding across all components." />
          <div className="flex flex-wrap gap-6">
            {RADIUS_SCALE.map((r) => (
              <div key={r.name} className="flex flex-col items-center gap-2">
                <div className={cn("h-12 w-12 bg-secondary", r.class)} />
                <p className="font-mono text-xs text-muted-foreground">{r.name}</p>
                <p className="text-[10px] text-muted-foreground/70">{r.px}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Buttons */}
        <section>
          <SectionHeader
            title="Button Variants"
            desc="Primary (amber), secondary (navy), outline, ghost, destructive, link."
          />
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Primary (Amber)</Button>
              <Button variant="secondary">Secondary (Navy)</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" variant="outline">
                ⚙
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled>Disabled Primary</Button>
              <Button variant="secondary" disabled>
                Disabled Secondary
              </Button>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section>
          <SectionHeader title="Badges" desc="Status indicators, tags, and labels." />
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Published", style: { background: "#EAF5EE", color: "#2A7A4A" } },
              { label: "Draft", style: { background: "#EDF2F6", color: "#3D5A73" } },
              { label: "In Progress", style: { background: "#E3EFF8", color: "#1A5F8A" } },
              { label: "Pending Review", style: { background: "#FEF3E2", color: "#B56A10" } },
              { label: "Error", style: { background: "#FDEAEA", color: "#A53030" } },
              { label: "100 CEU Hours", style: { background: "#162D4A", color: "#E4A94A" } },
              { label: "New", style: { background: "#C98A2A", color: "#FFFFFF" } },
            ].map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                style={b.style}
              >
                {b.label}
              </span>
            ))}
          </div>
        </section>

        {/* Form Elements */}
        <section>
          <SectionHeader
            title="Form Elements"
            desc="Inputs, selects, labels — with focus, error, and helper text states."
          />
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Journey Stage</label>
              <select className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {JOURNEY_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">CEU Hours</label>
              <input
                type="number"
                placeholder="75"
                className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Enter clock hours for this course</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Status</label>
              <input
                readOnly
                value="Validation error"
                className="h-10 rounded-md border-2 px-3 text-sm focus:outline-none"
                style={{
                  borderColor: "var(--color-error)",
                  backgroundColor: "var(--color-error-bg)",
                  color: "var(--color-error)",
                }}
              />
              <p className="text-xs" style={{ color: "var(--color-error)" }}>
                This field is required
              </p>
            </div>
          </div>
        </section>

        {/* Course Card */}
        <section>
          <SectionHeader title="Course Card" desc="Used in course listings and the learner dashboard." />
          <div className="grid max-w-sm grid-cols-1 gap-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div
                className="flex h-32 items-end p-4"
                style={{ background: "linear-gradient(135deg, #162D4A 0%, #1E3D5C 100%)" }}
              >
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: "#C98A2A", color: "#fff" }}
                >
                  Licensure
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-base font-semibold leading-tight text-foreground">
                  Certified Home Inspector — 100-Hour Professional Course
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  100 CEU Hours · 13 Modules · 52 Lessons
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full w-2/5 rounded-full"
                    style={{ background: "var(--color-amber)" }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">40% complete</p>
                <Button className="mt-3 w-full" size="sm">
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Journey Stages */}
        <section>
          <SectionHeader
            title="Journey Stages"
            desc="Six distinct learner journey stages, each with its own color identity."
          />
          <div className="mb-6 flex flex-wrap gap-2">
            {JOURNEY_STAGES.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveStage(s.key)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-all",
                  activeStage === s.key
                    ? "scale-105 text-white shadow-lg"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
                style={activeStage === s.key ? { backgroundColor: s.color } : {}}
              >
                {s.label}
              </button>
            ))}
          </div>
          {activeStageData && (
            <div
              className="rounded-xl p-6 text-white transition-all duration-500"
              style={{ backgroundColor: activeStageData.color }}
            >
              <h3 className="text-xl font-bold">{activeStageData.label}</h3>
              <p className="mt-1 text-sm text-white/80">{activeStageData.desc}</p>
              <p className="mt-2 font-mono text-xs text-white/50">{activeStageData.color}</p>
            </div>
          )}
        </section>

        {/* Dark Mode Preview */}
        <section>
          <SectionHeader
            title="Dark Mode"
            desc="Dark mode uses navy-deep background with amber primary accents."
          />
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Preview</span>
              <button
                onClick={() => setDarkPreview((v) => !v)}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              >
                {darkPreview ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {darkPreview ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
            <div
              className="p-6 transition-colors duration-300"
              style={
                darkPreview
                  ? { background: "#0D1C2E", color: "#DDE8F0" }
                  : { background: "#FAF7F2", color: "#0D1C2B" }
              }
            >
              <div
                className="mb-4 rounded-lg p-4"
                style={
                  darkPreview
                    ? { background: "#1E3D5C", border: "1px solid #253D58" }
                    : { background: "#FFFFFF", border: "1px solid #C9D9E4" }
                }
              >
                <p
                  className="font-semibold"
                  style={{ color: darkPreview ? "#DDE8F0" : "#0D1C2B" }}
                >
                  Certified Home Inspector Course
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: darkPreview ? "#8CA5BD" : "#6B8499" }}
                >
                  Module 4: Electrical Systems · 75 min
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  className="rounded-md px-4 py-2 text-sm font-semibold"
                  style={{
                    background: darkPreview ? "#E4A94A" : "#C98A2A",
                    color: darkPreview ? "#0D1C2E" : "#FFFFFF",
                  }}
                >
                  Continue Learning
                </button>
                <button
                  className="rounded-md px-4 py-2 text-sm font-semibold"
                  style={
                    darkPreview
                      ? { background: "#1E3D5C", color: "#DDE8F0", border: "1px solid #253D58" }
                      : { background: "transparent", color: "#162D4A", border: "1px solid #162D4A" }
                  }
                >
                  View Modules
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* CSS Custom Properties */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">CSS Custom Properties</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Copy-paste into any stylesheet.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(CSS_VARS_OUTPUT, "css-vars")}
            >
              {copied === "css-vars" ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy all
                </>
              )}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-lg p-5 text-xs font-mono leading-relaxed" style={{ background: "#0D1C2B", color: "#DDE8F0" }}>
            {CSS_VARS_OUTPUT}
          </pre>
        </section>
      </div>
    </main>
  );
}
