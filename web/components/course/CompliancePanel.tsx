"use client";

import { Award, CheckCircle2, Clock, MinusCircle, XCircle } from "lucide-react";
import type { ComplianceCheck, ComplianceDecision } from "@/lib/api/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function StatusIcon({ status }: { status: ComplianceCheck["status"] }) {
  if (status === "passed") return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (status === "failed") return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === "pending") return <Clock className="h-5 w-5 text-amber-500" />;
  return <MinusCircle className="h-5 w-5 text-muted-foreground" />;
}

export interface CompliancePanelProps {
  decision: ComplianceDecision;
}

export function CompliancePanel({ decision }: CompliancePanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Award
            className={cn(
              "h-6 w-6",
              decision.eligible ? "text-emerald-600" : "text-muted-foreground",
            )}
          />
          <CardTitle className="text-lg">
            {decision.eligible
              ? "Eligible for certificate"
              : "Certificate requirements"}
          </CardTitle>
        </div>
        {decision.eligible ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            You&apos;ve met every requirement for this course. Your certificate will be issued with{" "}
            <span className="font-semibold">{decision.ceu_hours_awarded} CEU hours</span>
            {decision.accrediting_body && <> accredited by {decision.accrediting_body}</>}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Complete the outstanding requirements below to become eligible for your certificate.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {decision.checks.map((check) => (
            <li
              key={check.id}
              className={cn(
                "flex items-start gap-3 rounded-md border border-border p-3",
                check.status === "passed" && "bg-emerald-500/5",
                check.status === "failed" && "bg-destructive/5",
                check.status === "pending" && "bg-amber-500/5",
              )}
            >
              <StatusIcon status={check.status} />
              <div className="flex-1">
                <p className="text-sm font-medium">{check.label}</p>
                {check.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {decision.blockers.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-semibold text-destructive">
              {decision.blockers.length} blocker{decision.blockers.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {decision.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
