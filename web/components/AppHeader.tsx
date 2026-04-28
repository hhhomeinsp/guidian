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
    <header className="header-frosted sticky top-0 z-50">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-[#1D1D1F]">
          <GuidianLogo size={26} strokeColor="#162D4A" accentColor="#C98A2A" />
          <span className="text-sm font-semibold text-[#1D1D1F]">Guidian</span>
        </Link>
        <nav className="flex items-center gap-0.5">
          <Link
            href="/courses"
            className="rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-black/5"
          >
            Courses
          </Link>
          <Link
            href="/certificates"
            className="hidden rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-black/5 sm:inline-flex"
          >
            Certificates
          </Link>
          <Link
            href="/activity"
            className="hidden rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-black/5 sm:inline-flex"
          >
            Activity
          </Link>
          <Link
            href="/settings"
            className="hidden rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-black/5 sm:inline-flex"
          >
            Settings
          </Link>
          {me && (me.role === "admin" || me.role === "org_admin") && (
            <Link
              href="/admin"
              className="rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#0071E3] transition-colors hover:bg-black/5"
            >
              Admin
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="text-[#6E6E73] hover:bg-black/5 hover:text-[#1D1D1F]"
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </Button>
          {me ? (
            <>
              <span className="hidden text-sm text-[#6E6E73] sm:inline px-2">
                {me.full_name ?? me.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                aria-label="Sign out"
                className="text-[#6E6E73] hover:bg-black/5 hover:text-[#1D1D1F]"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-[#D2D2D7] px-4 py-1.5 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-black/5"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
