"use client";

import React from "react";
import Link from "next/link";
import {
  useCompliance,
  useCourse,
  useIssueCertificate,
  useMe,
  useMyCertificates,
  useUpdateIdentity,
} from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { CompliancePanel, ProgressCheck } from "@/components/course";

export default function CourseDetailPage({
  params,
}: {
  params: { courseId: string };
}) {
  const course = useCourse(params.courseId);
  const compliance = useCompliance(params.courseId);
  const myCerts = useMyCertificates();
  const issue = useIssueCertificate(params.courseId);
  const me = useMe();
  const updateIdentity = useUpdateIdentity();

  // Identity gate form state
  const [idFullName, setIdFullName] = React.useState("");
  const [idLicense, setIdLicense] = React.useState("");
  const [idSsn, setIdSsn] = React.useState("");
  const [idError, setIdError] = React.useState("");

  const existingCert = myCerts.data?.find((c) => c.course_id === params.courseId);
  const identityVerified = !!me.data?.profile?.identity_verified_at;

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdError("");
    if (!idFullName.trim()) { setIdError("Full legal name is required."); return; }
    if (!idLicense.trim() && !idSsn.trim()) {
      setIdError("Please provide a license number or the last 4 digits of your SSN.");
      return;
    }
    try {
      await updateIdentity.mutateAsync({
        full_name: idFullName.trim(),
        license_number: idLicense.trim() || null,
        last_four_ssn: idSsn.trim() || null,
      });
    } catch {
      setIdError("Failed to save identity. Please try again.");
    }
  };

  if (course.isLoading) return <Shell>Loading…</Shell>;
  if (course.error || !course.data) return <Shell>Course not found.</Shell>;

  const c = course.data;
  const modules = c.modules ?? [];

  return (
    <Shell>
      {/* Course hero */}
      <div className="rounded-xl px-8 py-8" style={{background: "linear-gradient(135deg, #162D4A 0%, #1E3D5C 60%, #095857 100%)"}}>
        <h1 className="font-display text-2xl font-bold text-white leading-snug">{c.title}</h1>
        {c.description && (
          <p className="mt-3 font-body text-sm text-white/70 max-w-2xl leading-relaxed">{c.description}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white">
            {c.ceu_hours} CEU hours
          </span>
          {c.accrediting_body && (
            <span className="inline-flex items-center rounded-full border border-white/30 px-3 py-1 text-sm text-white/80">
              {c.accrediting_body}
            </span>
          )}
        </div>
      </div>

      {/* Module list */}
      <div className="space-y-4">
        {modules.map((m, mi) => (
          <div key={m.id} className="rounded-xl border border-cloud bg-white shadow-card">
            <div className="border-b border-cloud px-5 py-4">
              <h2 className="font-display text-base font-semibold text-navy">
                Module {mi + 1}: {m.title}
              </h2>
              {m.description && (
                <p className="mt-1 font-body text-sm text-steel">{m.description}</p>
              )}
            </div>
            <div className="p-3 space-y-1">
              {m.lessons.map((l, li) => (
                <Link
                  key={l.id}
                  href={`/courses/${c.id}/lessons/${l.id}`}
                  className="flex items-center justify-between rounded-lg border border-transparent px-4 py-2.5 transition-colors hover:border-cloud hover:bg-fog"
                >
                  <span className="font-body text-sm">
                    <span className="text-steel">{mi + 1}.{li + 1}</span>{" "}
                    <span className="font-medium text-ink">{l.title}</span>
                  </span>
                  <span className="font-body text-xs text-steel shrink-0 ml-4">
                    {l.clock_minutes} min
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Compliance / certificate section */}
      {compliance.data ? (
        <div className="space-y-4">
          <CompliancePanel decision={compliance.data} />
          {compliance.data.eligible && (
            <div className="rounded-xl border border-teal/30 bg-teal/5 px-6 py-5 space-y-4">
              {/* Identity gate */}
              {!identityVerified && !existingCert && (
                <div>
                  <p className="font-body text-sm font-semibold text-navy mb-1">
                    Identity verification required before certificate issuance
                  </p>
                  <p className="font-body text-xs text-steel mb-3">
                    For CE record purposes, please provide your legal name and one of the following.
                  </p>
                  <form onSubmit={handleIdentitySubmit} className="space-y-3">
                    <div>
                      <label className="block font-body text-xs font-medium text-ink mb-1" htmlFor="id-full-name">
                        Full legal name <span aria-hidden>*</span>
                      </label>
                      <input
                        id="id-full-name"
                        type="text"
                        required
                        value={idFullName}
                        onChange={e => setIdFullName(e.target.value)}
                        className="w-full rounded-md border border-cloud bg-white px-3 py-2 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal"
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-xs font-medium text-ink mb-1" htmlFor="id-license">
                        License number <span className="text-steel font-normal">(or last 4 SSN)</span>
                      </label>
                      <input
                        id="id-license"
                        type="text"
                        value={idLicense}
                        onChange={e => setIdLicense(e.target.value)}
                        className="w-full rounded-md border border-cloud bg-white px-3 py-2 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal"
                        placeholder="HI-123456"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-xs font-medium text-ink mb-1" htmlFor="id-ssn">
                        Last 4 digits of SSN <span className="text-steel font-normal">(if no license)</span>
                      </label>
                      <input
                        id="id-ssn"
                        type="text"
                        maxLength={4}
                        pattern="\d{4}"
                        value={idSsn}
                        onChange={e => setIdSsn(e.target.value.replace(/\D/g, ""))}
                        className="w-full rounded-md border border-cloud bg-white px-3 py-2 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal"
                        placeholder="1234"
                      />
                    </div>
                    {idError && (
                      <p role="alert" className="font-body text-xs text-red-600">{idError}</p>
                    )}
                    <Button
                      type="submit"
                      disabled={updateIdentity.isPending}
                      className="w-full rounded-full"
                    >
                      {updateIdentity.isPending ? "Saving…" : "Verify & continue"}
                    </Button>
                  </form>
                </div>
              )}

              {/* Certificate issuance (shown once identity verified) */}
              {(identityVerified || existingCert) && (
                <div className="flex items-center justify-between">
                  <div className="font-body text-sm">
                    <p className="font-semibold text-teal">
                      {existingCert
                        ? existingCert.status === "issued"
                          ? "Your certificate is ready."
                          : existingCert.status === "pending"
                            ? "Rendering your certificate…"
                            : "Certificate render failed."
                        : "You're ready to claim your certificate."}
                    </p>
                    {existingCert?.status === "issued" && (
                      <p className="text-steel mt-0.5">
                        Verification code:{" "}
                        <span className="font-mono">{existingCert.verification_code}</span>
                      </p>
                    )}
                  </div>
                  {existingCert ? (
                    <Link
                      href={`/certificates/${existingCert.id}`}
                      className="inline-flex items-center rounded-md bg-amber px-4 py-2 text-sm font-medium text-white shadow-amber hover:bg-amber-light transition-colors"
                    >
                      View certificate →
                    </Link>
                  ) : (
                    <Button onClick={() => issue.mutate()} disabled={issue.isPending}>
                      {issue.isPending ? "Issuing…" : "Issue certificate"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <ProgressCheck
          status="in_progress"
          label="Course completion"
          description="Complete all lessons and pass the final assessment"
          ceuHours={c.ceu_hours}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="container space-y-6 py-8 min-h-screen bg-[#F5F5F7]">{children}</main>;
}
