"use client";

import Link from "next/link";
import { useSubscription } from "@/lib/api/hooks";
import { getAccessToken } from "@/lib/api/client";

interface ProGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Usage: <ProGate feature="AI Teacher">...</ProGate>
// Renders children for Pro/Org users; shows upgrade prompt for Free/Learner.
export function ProGate({ feature, children, fallback }: ProGateProps) {
  const hasToken =
    typeof window !== "undefined" ? !!getAccessToken() : false;
  const { data: sub, isLoading } = useSubscription();

  if (isLoading) return null;

  const isPro =
    sub?.plan === "pro" ||
    sub?.plan === "organization" ||
    sub?.plan === "org";

  if (isPro) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="rounded-xl border border-[#0071E3]/20 bg-[#0071E3]/5 p-8 text-center">
      <p className="font-display text-base font-semibold text-[#1D1D1F] mb-1">
        {feature}
      </p>
      <p className="font-body text-sm text-[#6E6E73] mb-5">
        This feature is available on the Pro plan.
      </p>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 rounded-full bg-[#0071E3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0065CE] transition-colors"
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}
