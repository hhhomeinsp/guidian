"use client";

import { useAdminUsers } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-primary/10 text-primary",
  org_admin: "bg-primary/10 text-primary",
  instructor: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  learner: "bg-muted text-muted-foreground",
};

export default function AdminUsersPage() {
  const users = useAdminUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          All registered learners, instructors, and admins.
        </p>
      </div>
      {users.isLoading && <p className="text-muted-foreground">Loading…</p>}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[u.role] ?? ""}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="text-emerald-600">active</span>
                    ) : (
                      <span className="text-destructive">inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
