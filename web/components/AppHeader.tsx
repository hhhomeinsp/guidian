"use client";

import Link from "next/link";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { logout, useMe } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { data: me } = useMe();
  const { theme, setTheme } = useTheme();

  return (
    <header className="border-b border-border">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Guidian
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/courses"
            className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Courses
          </Link>
          <Link
            href="/certificates"
            className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Certificates
          </Link>
          <Link
            href="/activity"
            className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Activity
          </Link>
          {me && (me.role === "admin" || me.role === "org_admin") && (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent"
            >
              Admin
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </Button>
          {me ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {me.full_name ?? me.email}
              </span>
              <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
