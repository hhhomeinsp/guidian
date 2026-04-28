"use client";

import Link from "next/link";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { logout, useMe, useSubscription } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export function AppHeader() {
  const { data: me } = useMe();
  const { data: sub } = useSubscription();
  const { theme, setTheme } = useTheme();
  const showPricing = !me?.id || !sub || sub.plan === "free";

  return (
    <header className="header-frosted sticky top-0 z-50">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center">
          {/* Light mode: dark logo | Dark mode: white logo */}
          <Image src="/brand/logo-light.svg" alt="Guidian" width={120} height={22} className="block dark:hidden" priority />
          <Image src="/brand/logo-dark.svg" alt="Guidian" width={120} height={22} className="hidden dark:block" priority />
        </Link>
        <nav className="flex items-center gap-0.5">
          <Link
            href="/courses"
            className="rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            Courses
          </Link>
          {me && (
            <Link
              href="/teacher"
              className="hidden rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:inline-flex"
            >
              My Instructor
            </Link>
          )}
          <Link
            href="/certificates"
            className="hidden rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:inline-flex"
          >
            Certificates
          </Link>
          <Link
            href="/activity"
            className="hidden rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:inline-flex"
          >
            Activity
          </Link>
          {showPricing && (
            <Link
              href="/pricing"
              className="hidden rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:inline-flex"
            >
              Pricing
            </Link>
          )}
          <Link
            href="/settings"
            className="hidden rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:inline-flex"
          >
            Settings
          </Link>
          {me && (me.role === "admin" || me.role === "org_admin") && (
            <Link
              href="/admin"
              className="rounded-[8px] px-3 py-1.5 text-sm font-medium text-[#1D1D1F] dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              Admin
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="text-[#6E6E73] dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1D1D1F]"
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
                className="text-[#6E6E73] dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1D1D1F]"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-[#D2D2D7] dark:border-white/30 px-4 py-1.5 text-sm font-medium text-[#1D1D1F] dark:text-white dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
