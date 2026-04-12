"use client";

import { Award, BookOpenCheck, CheckCircle2, HelpCircle, PlayCircle, XCircle } from "lucide-react";
import { useMyStatements } from "@/lib/api/hooks";
import type { XAPIStatementRead } from "@/lib/api/schema";
import { Card, CardContent } from "@/components/ui/card";

const VERB_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  "http://adlnet.gov/expapi/verbs/registered": {
    label: "Registered",
    icon: PlayCircle,
    color: "text-sky-600",
  },
  "http://adlnet.gov/expapi/verbs/attempted": {
    label: "Attempted",
    icon: HelpCircle,
    color: "text-amber-500",
  },
  "http://adlnet.gov/expapi/verbs/passed": {
    label: "Passed",
    icon: CheckCircle2,
    color: "text-emerald-600",
  },
  "http://adlnet.gov/expapi/verbs/failed": {
    label: "Failed",
    icon: XCircle,
    color: "text-destructive",
  },
  "http://adlnet.gov/expapi/verbs/completed": {
    label: "Completed",
    icon: BookOpenCheck,
    color: "text-emerald-600",
  },
  "http://id.tincanapi.com/verb/earned": {
    label: "Earned",
    icon: Award,
    color: "text-primary",
  },
};

function renderVerb(stmt: XAPIStatementRead) {
  return VERB_META[stmt.verb.id] ?? {
    label: stmt.verb.display?.["en-US"] ?? stmt.verb.id,
    icon: HelpCircle,
    color: "text-muted-foreground",
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
        <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
        <p className="text-muted-foreground">
          Your xAPI statement feed — every material learning event emitted by Guidian's internal Learning Record Store.
        </p>
      </div>
      {statements.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {statements.data && statements.data.length === 0 && (
        <p className="text-muted-foreground">
          No activity yet. Enroll in a course and complete a lesson to see statements here.
        </p>
      )}
      <ul className="space-y-2">
        {(statements.data ?? []).map((stmt) => {
          const verb = renderVerb(stmt);
          const Icon = verb.icon;
          const result = renderResult(stmt);
          return (
            <li key={stmt.id}>
              <Card>
                <CardContent className="flex items-start gap-3 p-4">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${verb.color}`} />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{verb.label}</span>{" "}
                      <span className="text-muted-foreground">{activityName(stmt)}</span>
                    </p>
                    {result && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{result}</p>
                    )}
                  </div>
                  <time className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(stmt.stored_at).toLocaleString()}
                  </time>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
