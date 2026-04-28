"use client";

import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <main className="container flex min-h-[70vh] items-center justify-center py-16">
      <div className="text-center max-w-sm">
        <div className="mb-6 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F2F2F7]">
            <span className="text-3xl">👋</span>
          </div>
        </div>
        <h1 className="font-display text-3xl font-semibold text-[#1D1D1F] mb-2">
          No worries
        </h1>
        <p className="font-body text-[#6E6E73] mb-8">
          You can always upgrade later. Your free account is still active.
        </p>
        <Link
          href="/pricing"
          className="inline-block rounded-full border border-[#D2D2D7] px-8 py-3 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-black/5"
        >
          View pricing
        </Link>
      </div>
    </main>
  );
}
