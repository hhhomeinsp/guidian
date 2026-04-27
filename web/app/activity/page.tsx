"use client";

import { Award, BookOpenCheck, CheckCircle2, HelpCircle, PlayCircle, XCircle } from "lucide-react";
import { useMyStatements } from "@/lib/api/hooks";
import type { XAPIStatementRead } from "@/lib/api/schema";

const VERB_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; dotColor: string; textColor: string }
> = {
  "http://adlnet.gov/expapi/verbs/registered": {
    label: "Registered",
    icon: PlayCircle,
    dotColor: "bg-info",
    textColor: "text-info",
  },
  "http://adlnet.gov/expapi/verbs/attempted": {
    label: "Attempted",
    icon: HelpCircle,
    dotColor: "bg-amber",
    textColor: "text-amber",
  },
  "http://adlnet.gov/expapi/verbs/passed": {
    label: "Passed",
    icon: CheckCircle2,
    dotColor: "bg-teal",
    textColor: "text-teal",
  },
  "http://adlnet.gov/expapi/verbs/failed": {
    label: "Failed",
    icon: XCircle,
    dotColor: "bg-error",
    textColor: "text-error",
  },
  "http://adlnet.gov/expapi/verbs/completed": {
    label: "Completed",
    icon: BookOpenCheck,
    dotColor: "bg-teal",
    textColor: "text-teal",
  },
  "http://id.tincanapi.com/verb/earned": {
    label: "Earned",
    icon: Award,
    dotColor: "bg-amber",
    textColor: "text-amber",
  },
};

function renderVerb(stmt: XAPIStatementRead) {
  return VERB_META[stmt.verb.id] ?? {
    label: stmt.verb.display?.["en-US"] ?? stmt.verb.id,
    icon: HelpCircle,
    dotColor: "bg-steel",
    textColor: "text-steel",
  };
}

function activityName(stmt: XAPIStatementRead): string {
  return stmt.object.definition?.name?.["en-US"] ?? stmt.object.id;
}

function renderResult(stmt: XAPIStatementRead): string | null {
  const r = stmt.result;
  if (!r) return null;
  const bits: string[] = [];
  if (r.score?.scaled !== undefined) bits.push(`${Math.round(r.score.scaled * 100)}%`);
  if (r.duration) bits.push(r.duration.replace(/^PT/, ""));
  if (r.success === true) bits.push("success");
  if (r.success === false) bits.push("fail");
  return bits.length ? bits.join(" · ") : null;
}

export default function ActivityFeedPage() {
  const statements = useMyStatements(100);

  return (
    <main className="container space-y-6 py-8">
      <div>
        <div className="pb-4 border-b-2 border-amber inline-block">
          <h1 className="font-display text-3xl font-bold text-navy">Activity</h1>
        </div>
        <p className="mt-2 font-body text-steel">
          Your xAPI statement feed — every material learning event emitted by Guidian&apos;s internal Learning Record Store.
        </p>
      </div>
      {statements.isLoading && <p className="font-body text-steel">Loading…</p>}
      {statements.data && statements.data.length === 0 && (
        <p className="font-body text-steel">
          No activity yet. Enroll in a course and complete a lesson to see statements here.
        </p>
      )}

      {/* Timeline */}
      <ul className="relative space-y-0 pl-6">
        {/* Connector line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-cloud" aria-hidden />
        {(statements.data ?? []).map((stmt) => {
          const verb = renderVerb(stmt);
          const Icon = verb.icon;
          const result = renderResult(stmt);
          return (
            <li key={stmt.id} className="relative flex gap-4 pb-4">
              {/* Teal dot */}
              <span
                className={`relative z-10 mt-1 flex h-5 w-5 shrink-0 -ml-6 items-center justify-center rounded-full ${verb.dotColor}`}
                aria-hidden
              >
                <Icon className="h-3 w-3 text-white" />
              </span>
              <div className="flex-1 rounded-xl border border-cloud bg-white shadow-card px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-body text-sm">
                      <span className={`font-semibold ${verb.textColor}`}>{verb.label}</span>{" "}
                      <span className="text-slate">{activityName(stmt)}</span>
                    </p>
                    {result && (
                      <p className="mt-0.5 font-body text-xs text-steel">{result}</p>
                    )}
                  </div>
                  <time className="whitespace-nowrap font-body text-xs text-steel shrink-0">
                    {new Date(stmt.stored_at).toLocaleString()}
                  </time>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
