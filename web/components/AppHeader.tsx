"use client";

import Link from "next/link";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { logout, useMe } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { GuidianLogo } from "@/components/ui/GuidianLogo";

export function AppHeader() {
  const { data: me } = useMe();
  const { theme, setTheme } = useTheme();

  return (
    <header
      className="border-b-[3px]"
      style={{ backgroundColor: "var(--color-navy)", borderBottomColor: "var(--color-amber)" }}
    >
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-white">
          <GuidianLogo size={26} strokeColor="white" accentColor="#C98A2A" />
          <span className="text-sm font-bold tracking-widest uppercase">Guidian</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/courses"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            Courses
          </Link>
          <Link
            href="/certificates"
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            Certificates
          </Link>
          <Link
            href="/activity"
            className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            Activity
          </Link>
          {me && (me.role === "admin" || me.role === "org_admin") && (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10"
              style={{ color: "var(--color-amber-light)" }}
            >
              Admin
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </Button>
          {me ? (
            <>
              <span className="hidden text-sm text-white/50 sm:inline">
                {me.full_name ?? me.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                aria-label="Sign out"
                className="text-white/80 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
