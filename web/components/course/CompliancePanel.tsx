"use client";

import { Award, CheckCircle2, Clock, MinusCircle, XCircle } from "lucide-react";
import type { ComplianceCheck, ComplianceDecision } from "@/lib/api/schema";
import { cn } from "@/lib/utils";

function StatusIcon({ status }: { status: ComplianceCheck["status"] }) {
  if (status === "passed") return <CheckCircle2 className="h-5 w-5 text-teal shrink-0" />;
  if (status === "failed") return <XCircle className="h-5 w-5 text-error shrink-0" />;
  if (status === "pending") return <Clock className="h-5 w-5 text-amber shrink-0" />;
  return <MinusCircle className="h-5 w-5 text-steel shrink-0" />;
}

export interface CompliancePanelProps {
  decision: ComplianceDecision;
}

export function CompliancePanel({ decision }: CompliancePanelProps) {
  return (
    <div className="rounded-xl border border-cloud bg-white shadow-card">
      {/* Navy header */}
      <div className="rounded-t-xl bg-navy px-5 py-4">
        <div className="flex items-center gap-3">
          <Award
            className={cn(
              "h-6 w-6 shrink-0",
              decision.eligible ? "text-amber" : "text-mist",
            )}
          />
          <h3 className="font-display text-lg font-semibold text-white">
            {decision.eligible
              ? "Eligible for certificate"
              : "Certificate requirements"}
          </h3>
        </div>
        {decision.eligible ? (
          <p className="mt-2 font-body text-sm text-teal-light">
            You&apos;ve met every requirement for this course. Your certificate will be issued with{" "}
            <span className="font-semibold">{decision.ceu_hours_awarded} CEU hours</span>
            {decision.accrediting_body && <> accredited by {decision.accrediting_body}</>}.
          </p>
        ) : (
          <p className="mt-2 font-body text-sm text-mist">
            Complete the outstanding requirements below to become eligible for your certificate.
          </p>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        <ul className="space-y-2">
          {decision.checks.map((check) => (
            <li
              key={check.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3",
                check.status === "passed" && "border-teal/30 bg-teal/5",
                check.status === "failed" && "border-error/30 bg-error-bg",
                check.status === "pending" && "border-amber/30 bg-warning-bg",
                check.status === "not_applicable" && "border-cloud bg-fog",
              )}
            >
              <StatusIcon status={check.status} />
              <div className="flex-1">
                <p className="font-body text-sm font-medium text-navy">{check.label}</p>
                {check.detail && (
                  <p className="mt-0.5 font-body text-xs text-steel">{check.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {decision.blockers.length > 0 && (
          <div className="rounded-lg border border-error/30 bg-error-bg p-3">
            <p className="font-display text-sm font-semibold text-error">
              {decision.blockers.length} blocker{decision.blockers.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1 list-disc pl-5 font-body text-sm text-slate">
              {decision.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
