"use client";

import { useAdminUsers } from "@/lib/api/hooks";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-navy/10 text-navy",
  org_admin: "bg-navy/10 text-navy",
  instructor: "bg-amber/10 text-amber-dim",
  learner: "bg-fog text-steel",
};

export default function AdminUsersPage() {
  const users = useAdminUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy">Users</h1>
        <p className="font-body text-steel">
          All registered learners, instructors, and admins.
        </p>
      </div>
      {users.isLoading && <p className="font-body text-steel">Loading…</p>}
      <div className="rounded-xl border border-cloud bg-white shadow-card overflow-hidden">
        <table className="w-full font-body text-sm">
          <thead>
            <tr className="bg-cloud text-left">
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Name</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Email</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Role</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Status</th>
              <th className="px-4 py-3 font-body text-xs font-medium uppercase tracking-[0.12em] text-slate">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((u, i) => (
              <tr
                key={u.id}
                className={i % 2 === 1 ? "bg-fog" : "bg-white"}
              >
                <td className="px-4 py-3 font-medium text-navy">{u.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role] ?? "bg-fog text-steel"}`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.is_active ? (
                    <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success">active</span>
                  ) : (
                    <span className="rounded-full bg-error-bg px-2 py-0.5 text-xs font-medium text-error">inactive</span>
                  )}
                </td>
                <td className="px-4 py-3 text-steel">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
