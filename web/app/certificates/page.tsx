"use client";

import Link from "next/link";
import { useMyCertificates } from "@/lib/api/hooks";

export default function CertificatesListPage() {
  const certs = useMyCertificates();

  return (
    <main className="container space-y-6 py-8">
      <div className="pb-4 border-b-2 border-amber inline-block">
        <h1 className="font-display text-3xl font-bold text-navy">My certificates</h1>
      </div>
      {certs.isLoading && <p className="font-body text-steel">Loading…</p>}
      {certs.data && certs.data.length === 0 && (
        <p className="font-body text-steel">
          No certificates yet. Complete a course to earn one.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(certs.data ?? []).map((cert) => (
          <Link key={cert.id} href={`/certificates/${cert.id}`}>
            <div className="h-full rounded-xl border border-cloud bg-white shadow-card transition-shadow hover:shadow-card-hover">
              <div className="border-b border-cloud px-5 py-4 flex items-center justify-between">
                <span className="font-display text-base font-semibold text-navy">
                  {cert.ceu_hours} CEU hours
                </span>
                {cert.status === "issued" ? (
                  <span className="rounded-full bg-teal/10 px-3 py-0.5 font-body text-xs font-medium text-teal">
                    Issued
                  </span>
                ) : cert.status === "pending" ? (
                  <span className="rounded-full bg-warning-bg px-3 py-0.5 font-body text-xs font-medium text-warning">
                    Pending
                  </span>
                ) : (
                  <span className="rounded-full bg-error-bg px-3 py-0.5 font-body text-xs font-medium text-error capitalize">
                    {cert.status}
                  </span>
                )}
              </div>
              <div className="px-5 py-4">
                <p className="font-body text-sm text-steel">
                  Issued{" "}
                  {new Date(cert.issued_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="mt-1 font-mono text-xs text-steel">{cert.verification_code}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
