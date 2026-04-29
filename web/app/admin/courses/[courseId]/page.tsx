"use client";

import Link from "next/link";
import * as React from "react";
import {
  useCEURuleForCourse,
  useCourse,
  useCreateCEURule,
  useUpdateCEURule,
} from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";

interface RuleForm {
  total_ceu_hours: number;
  min_passing_score: number;
  requires_proctoring: boolean;
  requires_identity_verification: boolean;
  accrediting_body: string;
  min_clock_minutes: number;
  certificate_valid_days: number;
}

export default function AdminCourseEditorPage({
  params,
}: {
  params: { courseId: string };
}) {
  const course = useCourse(params.courseId);
  const rule = useCEURuleForCourse(params.courseId);
  const createRule = useCreateCEURule();
  const updateRule = useUpdateCEURule(rule.data?.id ?? "", params.courseId);

  const [form, setForm] = React.useState<RuleForm | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (rule.data) {
      setForm({
        total_ceu_hours: rule.data.total_ceu_hours,
        min_passing_score: rule.data.min_passing_score,
        requires_proctoring: rule.data.requires_proctoring,
        requires_identity_verification: rule.data.requires_identity_verification,
        accrediting_body: rule.data.accrediting_body ?? "",
        min_clock_minutes: rule.data.min_clock_minutes,
        certificate_valid_days: rule.data.certificate_valid_days ?? 0,
      });
    } else if (course.data && form === null) {
      setForm({
        total_ceu_hours: course.data.ceu_hours ?? 1.0,
        min_passing_score: 0.7,
        requires_proctoring: false,
        requires_identity_verification: false,
        accrediting_body: course.data.accrediting_body ?? "",
        min_clock_minutes: 0,
        certificate_valid_days: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule.data, course.data]);

  if (course.isLoading || !course.data || !form) {
    return <p className="font-body text-steel">Loading…</p>;
  }

  const c = course.data;

  const save = async () => {
    setStatus(null);
    const payload = {
      total_ceu_hours: form.total_ceu_hours,
      min_passing_score: form.min_passing_score,
      requires_proctoring: form.requires_proctoring,
      requires_identity_verification: form.requires_identity_verification,
      accrediting_body: form.accrediting_body || null,
      min_clock_minutes: form.min_clock_minutes,
      certificate_valid_days: form.certificate_valid_days || null,
    };
    try {
      if (rule.data) {
        await updateRule.mutateAsync(payload);
      } else {
        await createRule.mutateAsync({ course_id: c.id, ...payload });
      }
      setStatus("Saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.mesnova : "Save failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/courses" className="font-body text-sm text-amber hover:underline">
          ← All courses
        </Link>
        <h1 className="mt-1 font-display text-3xl font-bold text-navy">{c.title}</h1>
        <p className="font-body text-steel">{c.description}</p>
      </div>

      {/* CEU rules card */}
      <div className="rounded-xl border border-cloud bg-white shadow-card">
        <div className="border-b border-cloud px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy">CEU rules</h2>
          <p className="mt-0.5 font-body text-sm text-steel">
            These rules are the authoritative gate the compliance engine uses
            to decide certificate eligibility.
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Total CEU hours"
              value={form.total_ceu_hours}
              step={0.25}
              onChange={(v) => setForm({ ...form, total_ceu_hours: v })}
            />
            <NumberField
              label="Min passing score (0–1)"
              value={form.min_passing_score}
              step={0.05}
              min={0}
              max={1}
              onChange={(v) => setForm({ ...form, min_passing_score: v })}
            />
            <NumberField
              label="Min clock minutes (seat time)"
              value={form.min_clock_minutes}
              onChange={(v) => setForm({ ...form, min_clock_minutes: v })}
            />
            <NumberField
              label="Certificate valid (days)"
              value={form.certificate_valid_days}
              onChange={(v) => setForm({ ...form, certificate_valid_days: v })}
            />
            <TextField
              label="Accrediting body"
              value={form.accrediting_body}
              onChange={(v) => setForm({ ...form, accrediting_body: v })}
              placeholder="ANCC, NBCC, etc."
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <Checkbox
              label="Requires proctoring"
              checked={form.requires_proctoring}
              onChange={(v) => setForm({ ...form, requires_proctoring: v })}
            />
            <Checkbox
              label="Requires identity verification"
              checked={form.requires_identity_verification}
              onChange={(v) => setForm({ ...form, requires_identity_verification: v })}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={save} disabled={createRule.isPending || updateRule.isPending}>
              {createRule.isPending || updateRule.isPending ? "Saving…" : "Save rules"}
            </Button>
            {status && <span className="font-body text-sm text-steel">{status}</span>}
          </div>
        </div>
      </div>

      {/* Module outline card */}
      <div className="rounded-xl border border-cloud bg-white shadow-card">
        <div className="border-b border-cloud px-6 py-4">
          <h2 className="font-display text-base font-semibold text-navy">Module outline</h2>
          <p className="mt-0.5 font-body text-sm text-steel">
            Read-only view of the generated structure. Per-lesson authoring
            UI is planned for a future step.
          </p>
        </div>
        <div className="px-6 py-5 space-y-3">
          {(c.modules ?? []).map((m, mi) => (
            <div key={m.id} className="rounded-lg border border-cloud bg-fog p-4">
              <p className="font-display text-sm font-semibold text-navy">
                Module {mi + 1}: {m.title}
              </p>
              <ul className="mt-2 space-y-1">
                {m.lessons.map((l, li) => (
                  <li key={l.id} className="font-body text-sm text-slate">
                    {mi + 1}.{li + 1} {l.title}{" "}
                    <span className="text-xs text-steel">({l.clock_minutes} min)</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-body text-xs font-medium uppercase tracking-[0.15em] text-slate">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
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

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 font-body text-sm text-slate">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-cloud accent-amber"
      />
      {label}
    </label>
  );
}
