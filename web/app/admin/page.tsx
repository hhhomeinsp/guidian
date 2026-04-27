"use client";

import { useAdminMetrics } from "@/lib/api/hooks";

export default function AdminDashboard() {
  const metrics = useAdminMetrics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy">Dashboard</h1>
        <p className="font-body text-steel">
          Live metrics across the Guidian platform. Refreshes every 15 seconds.
        </p>
      </div>
      {metrics.isLoading && <p className="font-body text-steel">Loading…</p>}
      {metrics.error && (
        <p className="font-body text-error">Failed to load metrics.</p>
      )}
      {metrics.data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Total users" value={metrics.data.users_total} />
          <Metric label="Learners" value={metrics.data.learners_total} />
          <Metric
            label="Courses"
            value={`${metrics.data.courses_published} / ${metrics.data.courses_total}`}
            hint="published / total"
          />
          <Metric label="Enrollments" value={metrics.data.enrollments_total} />
          <Metric
            label="Certificates issued"
            value={metrics.data.certificates_issued}
          />
          <Metric
            label="AI jobs pending"
            value={metrics.data.ai_jobs_pending}
            tone={metrics.data.ai_jobs_pending > 0 ? "warning" : undefined}
          />
          <Metric
            label="AI jobs failed"
            value={metrics.data.ai_jobs_failed}
            tone={metrics.data.ai_jobs_failed > 0 ? "danger" : undefined}
          />
          <Metric
            label="Audit events (24h)"
            value={metrics.data.audit_events_24h}
          />
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "warning" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-error"
      : tone === "warning"
        ? "text-warning"
        : "text-navy";
  return (
    <div className="rounded-xl border border-cloud bg-white shadow-card border-l-4 border-l-teal overflow-hidden">
      <div className="px-5 pt-4 pb-1">
        <p className="font-body text-xs font-medium uppercase tracking-[0.15em] text-amber">
          {label}
        </p>
      </div>
      <div className="px-5 pb-5">
        <p className={`font-display text-3xl font-bold ${valueClass}`}>{value}</p>
        {hint && <p className="mt-0.5 font-body text-xs text-steel">{hint}</p>}
      </div>
    </div>
  );
}
