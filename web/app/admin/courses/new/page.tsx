"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useGenerateCourse } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";

export default function NewCoursePage() {
  const router = useRouter();
  const generate = useGenerateCourse();

  const [prompt, setPrompt] = React.useState("");
  const [targetAudience, setTargetAudience] = React.useState("");
  const [complianceRequirement, setComplianceRequirement] = React.useState("");
  const [ceuHours, setCeuHours] = React.useState(1.0);
  const [numModules, setNumModules] = React.useState(3);
  const [lessonsPerModule, setLessonsPerModule] = React.useState(3);
  const [accreditingBody, setAccreditingBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy">Generate course</h1>
        <p className="font-body text-steel">
          Describe the topic, audience, and compliance requirement. Claude will
          produce a full course structure with modules, lessons, objectives,
          and quizzes.
        </p>
      </div>

      <div className="rounded-xl border border-cloud bg-white shadow-card">
        <div className="border-b border-cloud px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy">Course brief</h2>
        </div>
        <div className="px-6 py-5">
          <form onSubmit={onSubmit} className="space-y-4">
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
            <Field
              label="Compliance requirement"
              value={complianceRequirement}
              onChange={setComplianceRequirement}
              placeholder="Annual HIPAA training"
            />
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="CEU hours" value={ceuHours} onChange={setCeuHours} step={0.25} min={0.25} max={40} />
              <NumberField label="Modules" value={numModules} onChange={setNumModules} step={1} min={1} max={20} />
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
            <Button type="submit" disabled={generate.isPending}>
              {generate.isPending ? "Queuing job…" : "Generate course"}
            </Button>
          </form>
        </div>
      </div>
    </div>
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
      <span className="font-body text-xs font-medium uppercase tracking-[0.15em] text-slate">{label}</span>
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
      <span className="font-body text-xs font-medium uppercase tracking-[0.15em] text-slate">{label}</span>
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
      <span className="font-body text-xs font-medium uppercase tracking-[0.15em] text-slate">{label}</span>
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
