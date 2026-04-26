"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { setTokens } from "@/lib/api/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setError("Missing tokens in callback URL. Please try signing in again.");
      return;
    }

    // Persist to localStorage (Google OAuth = persistent session)
    setTokens(accessToken, refreshToken, true);
    router.replace("/courses");
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-xl dark:bg-slate-900">
          <p className="text-center text-sm text-destructive">{error}</p>
          <a
            href="/login"
            className="mt-4 block text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 dark:from-slate-900 dark:to-slate-800">
      <div className="flex flex-col items-center gap-4">
        <Spinner />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-8 w-8 animate-spin text-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
