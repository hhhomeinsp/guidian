"use client";

import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import {
  useComplianceSubmissions,
  useCreateSubmission,
  useUpdateSubmission,
  useStateRequirements,
} from "@/lib/api/hooks";
import { useCourses } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/lib/api/client";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-[#E3F9E5] text-[#1E8A2E]",
  under_review: "bg-[#FFF3CD] text-[#856404]",
  submitted: "bg-[#E8F0FE] text-[#0071E3]",
  draft: "bg-[#F5F5F7] text-[#6E6E73]",
  rejected: "bg-[#FDECEA] text-[#C62828]",
  expired: "bg-[#FDECEA] text-[#C62828]",
};

function getStateColor(state: string, submissions: ReturnType<typeof useComplianceSubmissions>["data"]): string {
  const stateSubs = (submissions ?? []).filter((s) => s.state_code === state);
  if (stateSubs.some((s) => s.status === "approved")) return "bg-[#E3F9E5] text-[#1E8A2E] border-[#1E8A2E]";
  if (stateSubs.some((s) => s.status === "submitted" || s.status === "under_review")) return "bg-[#FFF3CD] text-[#856404] border-[#856404]";
  if (stateSubs.some((s) => s.status === "rejected" || s.status === "expired")) return "bg-[#FDECEA] text-[#C62828] border-[#C62828]";
  return "bg-[#F5F5F7] text-[#6E6E73] border-[#D2D2D7]";
}

async function downloadPack(courseId: string, stateCode: string) {
  const token = getAccessToken();
  const res = await fetch(`${BASE_URL}/compliance/courses/${courseId}/pack/${stateCode}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `compliance_pack_${stateCode}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CompliancePage() {
  const { data: submissions, isLoading } = useComplianceSubmissions();
  const { data: courses } = useCourses();
  const createSubmission = useCreateSubmission();
  const updateSubmission = useUpdateSubmission();

  const [showModal, setShowModal] = useState(false);
  const [modalCourseId, setModalCourseId] = useState("");
  const [modalState, setModalState] = useState("FL");
  const [modalProfession, setModalProfession] = useState("home_inspector");

  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editApproval, setEditApproval] = useState("");

  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const expiringSoon = (submissions ?? []).filter(
    (s) => s.expires_at && new Date(s.expires_at) <= in90Days && s.status === "approved",
  );

  const counts = {
    approved: (submissions ?? []).filter((s) => s.status === "approved").length,
    under_review: (submissions ?? []).filter((s) => s.status === "under_review").length,
    submitted: (submissions ?? []).filter((s) => s.status === "submitted").length,
    draft: (submissions ?? []).filter((s) => s.status === "draft").length,
  };

  async function handleCreateSubmission() {
    if (!modalCourseId) return;
    const sub = await createSubmission.mutateAsync({
      course_id: modalCourseId,
      state_code: modalState,
      profession: modalProfession,
    });
    setShowModal(false);
    downloadPack(modalCourseId, modalState);
  }

  async function handleUpdateStatus(id: string) {
    await updateSubmission.mutateAsync({
      id,
      body: { status: editStatus, approval_number: editApproval || undefined },
    });
    setEditId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-[#0071E3]" />
            Compliance Tracker
          </h1>
          <p className="font-body text-steel mt-1">Manage state regulatory approvals for your courses.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-[10px] bg-[#0071E3] px-4 py-2 text-sm font-semibold text-white hover:opacity-80 transition-opacity"
        >
          + New Submission
        </button>
      </div>

      {expiringSoon.length > 0 && (
        <div className="rounded-[14px] bg-[#FDECEA] border border-[#C62828] px-4 py-3 text-sm text-[#C62828] font-medium">
          {expiringSoon.length} approval{expiringSoon.length > 1 ? "s" : ""} expire within 90 days — action required.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Approved", count: counts.approved, color: "text-[#1E8A2E]" },
          { label: "Under Review", count: counts.under_review, color: "text-[#856404]" },
          { label: "Submitted", count: counts.submitted, color: "text-[#0071E3]" },
          { label: "Draft", count: counts.draft, color: "text-[#6E6E73]" },
        ].map(({ label, count, color }) => (
          <div key={label} className="rounded-[14px] bg-white border border-[#D2D2D7] shadow-card px-4 py-4 text-center">
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{count}</p>
            <p className="text-xs text-[#6E6E73] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* State grid */}
      <div className="rounded-[18px] bg-white border border-[#D2D2D7] shadow-card p-4">
        <h2 className="font-semibold text-[#1D1D1F] mb-3 text-sm">State Coverage</h2>
        <div className="flex flex-wrap gap-1.5">
          {US_STATES.map((st) => (
            <span
              key={st}
              className={cn(
                "rounded-[6px] border px-2 py-1 text-xs font-semibold",
                getStateColor(st, submissions),
              )}
            >
              {st}
            </span>
          ))}
        </div>
      </div>

      {/* Submissions table */}
      {isLoading && <p className="font-body text-steel">Loading…</p>}
      {(submissions ?? []).length > 0 && (
        <div className="overflow-x-auto rounded-[18px] border border-[#D2D2D7] bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D2D2D7] text-left">
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Course</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">State</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Status</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Submitted</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Approved</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Expires</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Approval #</th>
                <th className="px-4 py-3 font-medium text-[#6E6E73]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(submissions ?? []).map((sub) => (
                <tr key={sub.id} className="border-b border-[#F5F5F7] hover:bg-[#F5F5F7] transition-colors">
                  <td className="px-4 py-3 text-[#1D1D1F] max-w-[200px] truncate">
                    {sub.course_title ?? sub.course_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#1D1D1F]">{sub.state_code}</td>
                  <td className="px-4 py-3">
                    {editId === sub.id ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="rounded-[8px] border border-[#D2D2D7] px-2 py-1 text-xs"
                      >
                        {["draft","submitted","under_review","approved","rejected","expired"].map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", STATUS_COLORS[sub.status] ?? "bg-gray-100")}>
                        {sub.status.replace(/_/g, " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#6E6E73] tabular-nums">
                    {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#6E6E73] tabular-nums">
                    {sub.approved_at ? new Date(sub.approved_at).toLocaleDateString() : "—"}
                  </td>
                  <td className={cn("px-4 py-3 tabular-nums", sub.expires_at && new Date(sub.expires_at) <= in90Days ? "text-[#C62828] font-semibold" : "text-[#6E6E73]")}>
                    {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#6E6E73] font-mono text-xs">
                    {editId === sub.id ? (
                      <input
                        value={editApproval}
                        onChange={(e) => setEditApproval(e.target.value)}
                        placeholder="Approval #"
                        className="rounded-[8px] border border-[#D2D2D7] px-2 py-1 text-xs w-28"
                      />
                    ) : (
                      sub.approval_number ?? "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadPack(sub.course_id, sub.state_code)}
                        title="Download compliance pack"
                        className="rounded-[8px] border border-[#D2D2D7] p-1.5 text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      {editId === sub.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(sub.id)}
                            className="rounded-[8px] bg-[#0071E3] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-80"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="rounded-[8px] border border-[#D2D2D7] px-2.5 py-1 text-xs text-[#6E6E73] hover:bg-[#F5F5F7]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setEditId(sub.id); setEditStatus(sub.status); setEditApproval(sub.approval_number ?? ""); }}
                          className="rounded-[8px] border border-[#D2D2D7] px-2.5 py-1 text-xs text-[#6E6E73] hover:bg-[#F5F5F7]"
                        >
                          Update
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && (submissions ?? []).length === 0 && (
        <p className="font-body text-steel">No submissions yet. Click "New Submission" to get started.</p>
      )}

      {/* New submission modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-[18px] bg-white p-6 shadow-xl">
            <h2 className="font-semibold text-[#1D1D1F] text-lg mb-4">New Compliance Submission</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#6E6E73] mb-1">Course</label>
                <select
                  value={modalCourseId}
                  onChange={(e) => setModalCourseId(e.target.value)}
                  className="w-full rounded-[10px] border border-[#D2D2D7] px-3 py-2 text-sm"
                >
                  <option value="">Select a course…</option>
                  {(courses ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6E6E73] mb-1">State</label>
                <select
                  value={modalState}
                  onChange={(e) => setModalState(e.target.value)}
                  className="w-full rounded-[10px] border border-[#D2D2D7] px-3 py-2 text-sm"
                >
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6E6E73] mb-1">Profession</label>
                <input
                  value={modalProfession}
                  onChange={(e) => setModalProfession(e.target.value)}
                  className="w-full rounded-[10px] border border-[#D2D2D7] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateSubmission}
                disabled={!modalCourseId || createSubmission.isPending}
                className="flex-1 rounded-[10px] bg-[#0071E3] py-2 text-sm font-semibold text-white hover:opacity-80 disabled:opacity-40"
              >
                {createSubmission.isPending ? "Creating…" : "Create & Download Pack"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-[10px] border border-[#D2D2D7] px-4 py-2 text-sm text-[#6E6E73] hover:bg-[#F5F5F7]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
