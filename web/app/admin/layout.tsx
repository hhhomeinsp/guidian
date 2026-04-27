"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  Users,
  Workflow,
} from "lucide-react";
import { useMe } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/ai-jobs", label: "AI jobs", icon: Workflow },
  { href: "/admin/audit", label: "Audit log", icon: ClipboardList },
];

const ADMIN_ROLES = new Set(["admin", "org_admin"]);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (me.error) {
      router.replace("/login");
      return;
    }
    if (me.data && !ADMIN_ROLES.has(me.data.role)) {
      router.replace("/courses");
    }
  }, [me.data, me.error, router]);

  if (me.isLoading || !me.data) {
    return <main className="container py-12 font-body text-steel">Loading admin portal…</main>;
  }
  if (!ADMIN_ROLES.has(me.data.role)) {
    return null;
  }

  return (
    <div className="container grid gap-6 py-8 lg:grid-cols-[220px,1fr]">
      {/* Navy sidebar */}
      <aside className="space-y-1 rounded-xl bg-navy p-4 h-fit">
        <p className="mb-3 px-3 font-body text-xs font-medium uppercase tracking-[0.15em] text-amber">
          Admin portal
        </p>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md border-l-2 px-3 py-2 font-body text-sm font-medium transition-colors",
                active
                  ? "border-amber bg-navy-mid text-amber"
                  : "border-transparent text-white hover:bg-navy-mid hover:text-teal-light",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
