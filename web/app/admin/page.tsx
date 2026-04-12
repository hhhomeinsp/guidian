"use client";

import { useAdminMetrics } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboard() {
  const metrics = useAdminMetrics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Live metrics across the Guidian platform. Refreshes every 15 seconds.
        </p>
      </div>
      {metrics.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {metrics.error && (
        <p className="text-destructive">Failed to load metrics.</p>
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
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${toneClass}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
