"use client";

import Link from "next/link";
import * as React from "react";
import { useAIJobs } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-fog text-steel",
  running: "bg-amber/10 text-amber-dim",
  succeeded: "bg-success-bg text-success",
  failed: "bg-error-bg text-error",
  cancelled: "bg-fog text-steel",
};

export default function AdminAIJobsPage() {
  const [filter, setFilter] = React.useState<string>("");
  const jobs = useAIJobs(filter || undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">AI generation jobs</h1>
          <p className="font-body text-steel">
            Every Claude-generated course is queued through here. Refreshes every 5 seconds.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">+ New generation</Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "pending", "running", "succeeded", "failed"].map((s) => (
          <Button
            key={s || "all"}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s || "all"}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-cloud bg-white shadow-card overflow-hidden">
        <table className="w-full font-body text-sm">
          <thead>
            <tr className="bg-cloud text-left">
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Status</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Prompt</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Attempts</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Created</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Course</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Error</th>
            </tr>
          </thead>
          <tbody>
            {(jobs.data ?? []).map((j, i) => (
              <tr
                key={j.id}
                className={`align-top ${i % 2 === 1 ? "bg-fog" : "bg-white"}`}
              >
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[j.status] ?? "bg-fog text-steel"}`}>
                    {j.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="line-clamp-2 max-w-md text-slate">{j.prompt}</p>
                </td>
                <td className="px-4 py-3 text-steel">{j.attempts}</td>
                <td className="whitespace-nowrap px-4 py-3 text-steel">
                  {new Date(j.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {j.course_id ? (
                    <Link
                      href={`/admin/courses/${j.course_id}`}
                      className="font-mono text-xs text-amber-dim hover:underline"
                    >
                      {j.course_id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-xs text-steel">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {j.error && (
                    <p className="max-w-xs truncate text-xs text-error" title={j.error}>
                      {j.error}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.data && jobs.data.length === 0 && (
          <p className="p-4 font-body text-sm text-steel">No jobs in this view.</p>
        )}
      </div>
    </div>
  );
}
