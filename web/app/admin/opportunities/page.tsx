"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, TrendingUp } from "lucide-react";
import { useOpportunities } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

const COMPETITION_COLORS: Record<string, string> = {
  low: "bg-[#E3F9E5] text-[#1E8A2E]",
  medium: "bg-[#FFF3CD] text-[#856404]",
  high: "bg-[#FDECEA] text-[#C62828]",
};

const STATUS_COLORS: Record<string, string> = {
  pipeline: "bg-[#E8F0FE] text-[#0071E3]",
  in_progress: "bg-[#FFF3CD] text-[#856404]",
  published: "bg-[#E3F9E5] text-[#1E8A2E]",
  skipped: "bg-[#F5F5F7] text-[#6E6E73]",
};

function formatMarket(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function OpportunitiesPage() {
  const { data: opportunities, isLoading } = useOpportunities();
  const router = useRouter();

  const sorted = opportunities ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-[#0071E3]" />
          Course Pipeline
        </h1>
        <p className="font-body text-steel mt-1">Ranked by ROI — highest opportunity first.</p>
      </div>

      {isLoading && <p className="font-body text-steel">Loading…</p>}

      {sorted.length > 0 && (
        <div className="overflow-x-auto rounded-[18px] border border-[#D2D2D7] bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D2D2D7] text-left">
                <th className="px-4 py-3 font-medium text-[#6E6E73]">ROI Score</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Title</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Profession</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">States</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Holders</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Annual Market</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Competition</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Status</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((opp, idx) => {
                const isTopThree = idx < 3;
                return (
                  <tr
                    key={opp.id}
                    className={cn(
                      "border-b border-[#F5F5F7] transition-colors hover:bg-[#F5F5F7]",
                      isTopThree && "bg-[#F0F9FF]",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0071E3] tabular-nums">
                          {opp.roi_score.toFixed(0)}
                        </span>
                        {isTopThree && (
                          <span className="rounded-full bg-[#E3F9E5] px-2 py-0.5 text-xs font-semibold text-[#1E8A2E]">
                            High Priority
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1D1D1F] max-w-[240px]">
                      {opp.title}
                    </td>
                    <td className="px-4 py-3 text-[#6E6E73] capitalize">
                      {opp.profession.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-[#6E6E73]">
                      {opp.target_states.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-[#6E6E73] tabular-nums">
                      {opp.estimated_license_holders.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1D1D1F] tabular-nums">
                      {formatMarket(opp.annual_addressable_market)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                          COMPETITION_COLORS[opp.competition_level] ?? "bg-gray-100 text-gray-700",
                        )}
                      >
                        {opp.competition_level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                          STATUS_COLORS[opp.status] ?? "bg-gray-100 text-gray-700",
                        )}
                      >
                        {opp.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          router.push(`/admin/courses/chat?opportunity=${opp.id}`)
                        }
                        className="flex items-center gap-1 rounded-[8px] bg-[#0071E3] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                      >
                        Build
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <p className="font-body text-steel">No opportunities yet.</p>
      )}
    </div>
  );
}
