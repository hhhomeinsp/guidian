"use client";

import * as React from "react";
import { useAuditEvents } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";

const EVENT_TONES: Record<string, string> = {
  "enrollment.created": "text-sky-600",
  "lesson.completed": "text-emerald-600",
  "quiz.attempted": "text-amber-600",
  "quiz.passed": "text-emerald-600",
  "certificate.requested": "text-primary",
  "certificate.issued": "text-emerald-600",
  "certificate.failed": "text-destructive",
  "compliance.evaluated": "text-muted-foreground",
  "compliance.met": "text-emerald-600",
};

export default function AdminAuditPage() {
  const [eventType, setEventType] = React.useState("");
  const events = useAuditEvents({ event_type: eventType || undefined, limit: 200 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground">
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
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Payload</th>
              </tr>
            </thead>
            <tbody>
              {(events.data ?? []).map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${EVENT_TONES[e.event_type] ?? ""}`}>
                      {e.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {e.subject_user_id?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {e.course_id?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {JSON.stringify(e.payload, null, 0)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.data && events.data.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No events match the filter.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
