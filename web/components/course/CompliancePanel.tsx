"use client";

import { Award, CheckCircle2, Clock, MinusCircle, XCircle } from "lucide-react";
import type { ComplianceCheck, ComplianceDecision } from "@/lib/api/schema";
import { cn } from "@/lib/utils";

function StatusIcon({ status }: { status: ComplianceCheck["status"] }) {
  if (status === "passed") return <CheckCircle2 className="h-5 w-5 text-[#34C759] shrink-0" />;
  if (status === "failed") return <XCircle className="h-5 w-5 text-[#FF3B30] shrink-0" />;
  if (status === "pending") return <Clock className="h-5 w-5 text-[#FF9F0A] shrink-0" />;
  return <MinusCircle className="h-5 w-5 text-[#AEAEB2] shrink-0" />;
}

export interface CompliancePanelProps {
  decision: ComplianceDecision;
}

export function CompliancePanel({ decision }: CompliancePanelProps) {
  return (
    <div className="rounded-[18px] border border-[#D2D2D7] bg-white shadow-card">
      {/* Header with blue left accent */}
      <div
        className="rounded-t-[18px] bg-white border-b border-[#D2D2D7] px-5 py-4"
        style={{ borderLeft: "4px solid #0071E3" }}
      >
        <div className="flex items-center gap-3">
          <Award
            className={cn(
              "h-6 w-6 shrink-0",
              decision.eligible ? "text-[#C98A2A]" : "text-[#AEAEB2]",
            )}
          />
          <h3 className="text-lg font-semibold text-[#1D1D1F]">
            {decision.eligible
              ? "Eligible for certificate"
              : "Certificate requirements"}
          </h3>
        </div>
        {decision.eligible ? (
          <p className="mt-2 text-sm text-[#34C759]">
            You&apos;ve met every requirement for this course. Your certificate will be issued with{" "}
            <span className="font-semibold">{decision.ceu_hours_awarded} CEU hours</span>
            {decision.accrediting_body && <> accredited by {decision.accrediting_body}</>}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#6E6E73]">
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
                "flex items-start gap-3 rounded-[10px] border p-3",
                check.status === "passed" && "border-[#34C759]/30 bg-[#F0FFF4]",
                check.status === "failed" && "border-[#FF3B30]/30 bg-[#FFF2F1]",
                check.status === "pending" && "border-[#FF9F0A]/30 bg-[#FFF8EC]",
                check.status === "not_applicable" && "border-[#D2D2D7] bg-[#F5F5F7]",
              )}
            >
              <StatusIcon status={check.status} />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1D1D1F]">{check.label}</p>
                {check.detail && (
                  <p className="mt-0.5 text-xs text-[#6E6E73]">{check.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {decision.blockers.length > 0 && (
          <div className="rounded-[10px] border border-[#FF3B30]/30 bg-[#FFF2F1] p-3">
            <p className="text-sm font-semibold text-[#FF3B30]">
              {decision.blockers.length} blocker{decision.blockers.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-1 list-disc pl-5 text-sm text-[#1D1D1F]">
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
