"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLogin } from "@/lib/api/hooks";
import { setTokens } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { GuidianLogo } from "@/components/ui/GuidianLogo";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const pair = await login.mutateAsync({ email, password });
      setTokens(pair.access_token, pair.refresh_token, rememberMe);
      router.push("/courses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div
        className="w-full max-w-sm rounded-xl border border-cloud bg-white shadow-card"
        style={{ animation: "fadeIn 0.25s ease-out both" }}
      >
        {/* Navy header */}
        <div className="flex flex-col items-center gap-2 rounded-t-xl bg-navy px-8 py-6">
          <GuidianLogo size={32} strokeColor="white" accentColor="#C98A2A" />
          <span className="font-display text-xl font-bold text-white tracking-tight">
            Guidian
          </span>
          <p className="font-body text-xs text-mist">Sign in to your account</p>
        </div>

        <div className="px-8 pb-8 pt-6">
          {/* Google sign-in */}
          <button
            type="button"
            onClick={() => {
              window.location.href = "https://guidian-api.onrender.com/api/v1/auth/google";
            }}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-navy bg-white px-4 text-sm font-medium text-navy transition-colors hover:bg-fog"
          >
            <GoogleLogo />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-cloud" />
            <span className="font-body text-xs text-steel">or</span>
            <div className="h-px flex-1 bg-cloud" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
            <label className="block space-y-1.5">
              <span className="font-body text-xs font-medium uppercase tracking-[0.15em] text-slate">Email</span>
              <input
                type="email"
                value={email}
                required
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                className="block h-11 w-full rounded-lg border border-cloud bg-fog px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
              />
            </label>

            {/* Password with show/hide toggle */}
            <label className="block space-y-1.5">
              <span className="font-body text-xs font-medium uppercase tracking-[0.15em] text-slate">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  required
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="block h-11 w-full rounded-lg border border-cloud bg-fog px-3 pr-10 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-steel hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>

            {/* Remember me */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-cloud accent-amber"
              />
              <span className="font-body text-sm text-slate">Remember me</span>
            </label>

            {error && (
              <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={login.isPending}
            >
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center font-body text-sm text-steel">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-amber underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
