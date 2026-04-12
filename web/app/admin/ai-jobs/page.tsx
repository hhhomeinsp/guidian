"use client";

import Link from "next/link";
import * as React from "react";
import { useAIJobs } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_TONE: Record<string, string> = {
  pending: "text-muted-foreground",
  running: "text-amber-600",
  succeeded: "text-emerald-600",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

export default function AdminAIJobsPage() {
  const [filter, setFilter] = React.useState<string>("");
  const jobs = useAIJobs(filter || undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI generation jobs</h1>
          <p className="text-muted-foreground">
            Every Claude-generated course is queued through here. Refreshes every 5 seconds.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">+ New generation</Link>
        </Button>
      </div>

      <div className="flex gap-2">
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

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Prompt</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {(jobs.data ?? []).map((j) => (
                <tr key={j.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3">
                    <span className={`font-medium ${STATUS_TONE[j.status] ?? ""}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="line-clamp-2 max-w-md text-muted-foreground">{j.prompt}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{j.attempts}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(j.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {j.course_id ? (
                      <Link
                        href={`/admin/courses/${j.course_id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {j.course_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {j.error && (
                      <p className="max-w-xs truncate text-xs text-destructive" title={j.error}>
                        {j.error}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.data && jobs.data.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No jobs in this view.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
