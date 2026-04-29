"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useCCGenerateCourse, useCCJob, useGenerateCourse } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";

type Mode = "api" | "cc";

export default function NewCoursePage() {
  const router = useRouter();
  const generate = useGenerateCourse();
  const ccGenerate = useCCGenerateCourse();

  const [mode, setMode] = React.useState<Mode>("api");

  // Shared fields
  const [prompt, setPrompt] = React.useState("");
  const [targetAudience, setTargetAudience] = React.useState("");
  const [complianceRequirement, setComplianceRequirement] = React.useState("");
  const [ceuHours, setCeuHours] = React.useState(1.0);
  const [numModules, setNumModules] = React.useState(3);
  const [lessonsPerModule, setLessonsPerModule] = React.useState(3);
  const [accreditingBody, setAccreditingBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // CC-only fields
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(false);
  const [ccJobId, setCCJobId] = React.useState<string | null>(null);

  const ccJob = useCCJob(ccJobId);

  // Auto-generate slug from title unless the user has edited it manually
  React.useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      );
    }
  }, [title, slugManuallyEdited]);

  // Redirect on success
  React.useEffect(() => {
    if (ccJob.data?.status === "succeeded") {
      router.push("/admin/courses");
    }
  }, [ccJob.data?.status, router]);

  const onSubmitAPI = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await generate.mutateAsync({
        prompt,
        target_audience: targetAudience || undefined,
        compliance_requirement: complianceRequirement || undefined,
        ceu_hours: ceuHours,
        num_modules: numModules,
        lessons_per_module: lessonsPerModule,
        accrediting_body: accreditingBody || undefined,
      });
      router.push("/admin/ai-jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  };

  const onSubmitCC = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await ccGenerate.mutateAsync({
        title,
        slug,
        ceu_hours: ceuHours,
        num_modules: numModules,
        lessons_per_module: lessonsPerModule,
        accrediting_body: accreditingBody || undefined,
        prompt,
        target_audience: targetAudience || undefined,
      });
      setCCJobId(result.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy">Generate course</h1>
        <p className="font-body text-steel">
          Describe the topic, audience, and compliance requirement. Claude will
          produce a full course structure with modules, lessons, objectives, and quizzes.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <ModeButton active={mode === "api"} onClick={() => setMode("api")}>
          API billing
        </ModeButton>
        <ModeButton active={mode === "cc"} onClick={() => setMode("cc")}>
          Claude Code Max plan
        </ModeButton>
      </div>

      {mode === "cc" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Claude Code Max Plan — $0 generation cost
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
          Anthropic API — billed per token
        </span>
      )}

      {mode === "cc" && (
        <div className="rounded-xl border border-amber/40 bg-amber/5 px-4 py-3">
          <p className="font-body text-xs text-slate">
            <strong className="text-navy">Claude Code Max plan</strong> — LLM costs billed to your
            Claude Code subscription, not per-token API charges. The server runs{" "}
            <code className="font-mono text-xs">claude --print</code> for each module. Requires
            Claude Code CLI installed on the API server with an active Max plan session.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-cloud bg-white shadow-card">
        <div className="border-b border-cloud px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy">Course brief</h2>
        </div>
        <div className="px-6 py-5">
          <form
            onSubmit={mode === "api" ? onSubmitAPI : onSubmitCC}
            className="space-y-4"
          >
            {mode === "cc" && (
              <>
                <Field
                  label="Course title *"
                  value={title}
                  onChange={setTitle}
                  placeholder="HIPAA Privacy Rule Refresher"
                  required
                />
                <label className="block space-y-1.5">
                  <span className="font-body text-xs font-medium uppercase tracking-[0.15em] text-slate">
                    URL slug *
                  </span>
                  <input
                    type="text"
                    required
                    pattern="^[a-z0-9-]+$"
                    title="Lowercase letters, digits, and hyphens only"
                    placeholder="hipaa-privacy-rule-refresher"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugManuallyEdited(true);
                    }}
                    className="block w-full rounded-lg border border-cloud bg-fog px-3 py-2 font-mono text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                  />
                </label>
              </>
            )}

            <TextArea
              label="Topic / objective *"
              placeholder="e.g. HIPAA Privacy Rule refresher for pharmacy technicians"
              value={prompt}
              onChange={setPrompt}
              required
            />
            <Field
              label="Target audience"
              value={targetAudience}
              onChange={setTargetAudience}
              placeholder="Licensed pharmacy technicians"
            />
            {mode === "api" && (
              <Field
                label="Compliance requirement"
                value={complianceRequirement}
                onChange={setComplianceRequirement}
                placeholder="Annual HIPAA training"
              />
            )}
            <div className="grid grid-cols-3 gap-3">
              <NumberField
                label="CEU hours"
                value={ceuHours}
                onChange={setCeuHours}
                step={0.25}
                min={0.25}
                max={200}
              />
              <NumberField
                label="Modules"
                value={numModules}
                onChange={setNumModules}
                step={1}
                min={1}
                max={60}
              />
              <NumberField
                label="Lessons / module"
                value={lessonsPerModule}
                onChange={setLessonsPerModule}
                step={1}
                min={1}
                max={20}
              />
            </div>
            <Field
              label="Accrediting body"
              value={accreditingBody}
              onChange={setAccreditingBody}
              placeholder="ANCC, NBCC, etc."
            />

            {error && <p className="font-body text-sm text-error">{error}</p>}

            {!ccJobId && (
              <Button
                type="submit"
                disabled={generate.isPending || ccGenerate.isPending}
              >
                {generate.isPending || ccGenerate.isPending
                  ? "Queuing job…"
                  : mode === "cc"
                    ? "Generate with Claude Code"
                    : "Generate course"}
              </Button>
            )}
          </form>
        </div>
      </div>

      {/* CC job progress */}
      {ccJobId && ccJob.data && (
        <CCJobProgress job={ccJob.data} totalModules={numModules} />
      )}
    </div>
  );
}

function CCJobProgress({
  job,
  totalModules,
}: {
  job: { status: string; progress: Record<string, number>; error?: string | null };
  totalModules: number;
}) {
  const modulesDone = job.progress?.modules_done ?? 0;
  const modulesTotal = job.progress?.modules_total ?? totalModules;

  return (
    <div className="rounded-xl border border-cloud bg-white shadow-card px-6 py-5 space-y-3">
      <div className="flex items-center gap-3">
        {(job.status === "queued" || job.status === "running") && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber border-t-transparent" />
        )}
        {job.status === "succeeded" && (
          <span className="text-lg text-green-600">✓</span>
        )}
        {job.status === "failed" && (
          <span className="text-lg text-error">✗</span>
        )}
        <p className="font-body text-sm font-medium text-navy">
          {job.status === "queued" && "Queued — waiting to start…"}
          {job.status === "running" &&
            `Generating… (${modulesDone} / ${modulesTotal} modules done)`}
          {job.status === "succeeded" && "Course generated — redirecting…"}
          {job.status === "failed" && `Failed: ${job.error ?? "unknown error"}`}
        </p>
      </div>

      {job.status === "running" && modulesTotal > 0 && (
        <div className="h-1.5 w-full rounded-full bg-fog overflow-hidden">
          <div
            className="h-full rounded-full bg-amber transition-all duration-500"
            style={{ width: `${(modulesDone / modulesTotal) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border px-4 py-2 font-body text-sm font-medium transition-colors",
        active
          ? "border-amber bg-amber/10 text-navy"
          : "border-cloud bg-fog text-steel hover:border-amber/50 hover:text-navy",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-body text-xs font-medium uppercase tracking-[0.15em] text-slate">
        {label}
      </span>
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-cloud bg-fog px-3 py-2 font-body text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-body text-xs font-medium uppercase tracking-[0.15em] text-slate">
        {label}
      </span>
      <textarea
        required={required}
        placeholder={placeholder}
        value={value}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-cloud bg-fog px-3 py-2 font-body text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-body text-xs font-medium uppercase tracking-[0.15em] text-slate">
        {label}
      </span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block w-full rounded-lg border border-cloud bg-fog px-3 py-2 font-body text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
      />
    </label>
  );
}
