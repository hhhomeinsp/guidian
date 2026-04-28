"use client";

import Link from "next/link";
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLogin, useRegister } from "@/lib/api/hooks";
import { setTokens } from "@/lib/api/client";
import { GuidianLogo } from "@/components/ui/GuidianLogo";

export default function RegisterPage() {
  const register = useRegister();
  const login = useLogin();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register.mutateAsync({ email, password, full_name: fullName });
      const pair = await login.mutateAsync({ email, password });
      setTokens(pair.access_token, pair.refresh_token, true);
      window.location.href = "/courses";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-4">
      <div
        className="w-full max-w-sm rounded-[18px] bg-white p-12"
        style={{
          boxShadow: "0 12px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)",
          animation: "fadeIn 0.25s ease-out both",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <GuidianLogo size={36} strokeColor="#162D4A" accentColor="#C98A2A" />
          <span className="text-xl font-semibold text-[#1D1D1F]">Guidian</span>
          <p className="text-sm text-[#6E6E73]">Create your account</p>
        </div>

        {/* Google sign-up */}
        <button
          type="button"
          onClick={() => {
            window.location.href = "https://guidian-api.onrender.com/api/v1/auth/google";
          }}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-[10px] border border-[#D2D2D7] bg-white px-4 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
        >
          <GoogleLogo />
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#D2D2D7]" />
          <span className="text-xs text-[#6E6E73]">or</span>
          <div className="h-px flex-1 bg-[#D2D2D7]" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Full name */}
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-[#6E6E73]">Full name</span>
            <input
              type="text"
              value={fullName}
              autoComplete="name"
              onChange={(e) => setFullName(e.target.value)}
              className="block h-11 w-full rounded-[10px] border border-[#D2D2D7] bg-white px-3 text-sm text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
            />
          </label>

          {/* Email */}
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-[#6E6E73]">Email</span>
            <input
              type="email"
              value={email}
              required
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              className="block h-11 w-full rounded-[10px] border border-[#D2D2D7] bg-white px-3 text-sm text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
            />
          </label>

          {/* Password */}
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-[#6E6E73]">Password</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                required
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
                className="block h-11 w-full rounded-[10px] border border-[#D2D2D7] bg-white px-3 pr-10 text-sm text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6E73] hover:text-[#1D1D1F]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          {error && (
            <p className="rounded-[10px] bg-[#FFF2F1] px-3 py-2 text-sm text-[#FF3B30]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={register.isPending || login.isPending}
            className="h-11 w-full rounded-[10px] bg-[#0071E3] text-sm font-medium text-white transition-colors hover:bg-[#0077ED] disabled:opacity-50"
          >
            {register.isPending || login.isPending ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#6E6E73]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#0071E3] underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
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
