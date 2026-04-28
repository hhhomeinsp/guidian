"use client";

import { useAdminMetrics } from "@/lib/api/hooks";

export default function AdminDashboard() {
  const metrics = useAdminMetrics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1D1D1F]">Dashboard</h1>
        <p className="text-[#6E6E73]">
          Live metrics across the Guidian platform. Refreshes every 15 seconds.
        </p>
      </div>
      {metrics.isLoading && <p className="text-[#6E6E73]">Loading…</p>}
      {metrics.error && (
        <p className="text-[#FF3B30]">Failed to load metrics.</p>
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
      ? "text-[#FF3B30]"
      : tone === "warning"
        ? "text-[#FF9F0A]"
        : "text-[#0071E3]";
  return (
    <div className="rounded-[18px] bg-white shadow-card overflow-hidden">
      <div className="px-5 pt-4 pb-1">
        <p className="text-xs font-medium text-[#6E6E73]">{label}</p>
      </div>
      <div className="px-5 pb-5">
        <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-[#6E6E73]">{hint}</p>}
      </div>
    </div>
  );
}
