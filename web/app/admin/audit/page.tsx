"use client";

import * as React from "react";
import { useAuditEvents } from "@/lib/api/hooks";

const EVENT_TONES: Record<string, string> = {
  "enrollment.created": "text-info",
  "lesson.completed": "text-success",
  "quiz.attempted": "text-warning",
  "quiz.passed": "text-success",
  "certificate.requested": "text-amber-dim",
  "certificate.issued": "text-teal",
  "certificate.failed": "text-error",
  "compliance.evaluated": "text-steel",
  "compliance.met": "text-teal",
};

export default function AdminAuditPage() {
  const [eventType, setEventType] = React.useState("");
  const events = useAuditEvents({ event_type: eventType || undefined, limit: 200 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy">Audit log</h1>
        <p className="font-body text-steel">
          Append-only event log. Every material compliance action lands here
          inside the same DB transaction as its state change.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Filter by event_type (e.g. certificate.issued)"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="flex-1 rounded-lg border border-cloud bg-fog px-3 py-2 font-body text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        />
      </div>

      <div className="rounded-xl border border-cloud bg-white shadow-card overflow-hidden">
        <table className="w-full font-body text-sm">
          <thead>
            <tr className="bg-cloud text-left">
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Time</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Event</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Subject</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Course</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Payload</th>
            </tr>
          </thead>
          <tbody>
            {(events.data ?? []).map((e, i) => (
              <tr
                key={e.id}
                className={`align-top ${i % 2 === 1 ? "bg-fog" : "bg-white"}`}
              >
                <td className="whitespace-nowrap px-4 py-3 text-steel">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-mono text-xs font-medium ${EVENT_TONES[e.event_type] ?? "text-slate"}`}>
                    {e.event_type}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-steel">
                  {e.subject_user_id?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-steel">
                  {e.course_id?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <pre className="whitespace-pre-wrap text-xs text-steel">
                    {JSON.stringify(e.payload, null, 0)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.data && events.data.length === 0 && (
          <p className="p-4 font-body text-sm text-steel">No events match the filter.</p>
        )}
      </div>
    </div>
  );
}
