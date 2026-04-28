"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getAccessToken } from "@/lib/api/client";

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "learner";
  const annual = searchParams.get("annual") === "true";
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      const redirect = encodeURIComponent(
        `/billing/checkout?plan=${plan}${annual ? "&annual=true" : ""}`
      );
      router.push(`/register?redirect=${redirect}`);
      return;
    }

    apiFetch<{ checkout_url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        plan,
        annual,
        success_url:
          window.location.origin + `/billing/success?plan=${plan}`,
        cancel_url: window.location.origin + "/pricing",
      }),
    })
      .then((data) => {
        window.location.href = data.checkout_url;
      })
      .catch(() => {
        setError("Could not start checkout. Please try again.");
      });
  }, [plan, annual, router]);

  if (error) {
    return (
      <main className="container flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <p className="font-body text-sm text-[#FF3B30]">{error}</p>
          <a
            href="/pricing"
            className="inline-block rounded-full bg-[#0071E3] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#0065CE] transition-colors"
          >
            Back to pricing
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="container flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0071E3] border-t-transparent mx-auto" />
        <p className="font-body text-sm text-[#6E6E73]">
          Redirecting to checkout…
        </p>
      </div>
    </main>
  );
}

export default function BillingCheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="container flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0071E3] border-t-transparent" />
        </main>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
