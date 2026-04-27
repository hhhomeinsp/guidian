"use client";

import Link from "next/link";
import {
  useCompliance,
  useCourse,
  useIssueCertificate,
  useMyCertificates,
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

  const existingCert = myCerts.data?.find((c) => c.course_id === params.courseId);

  if (course.isLoading) return <Shell>Loading…</Shell>;
  if (course.error || !course.data) return <Shell>Course not found.</Shell>;

  const c = course.data;
  const modules = c.modules ?? [];

  return (
    <Shell>
      {/* Course hero: navy bg */}
      <div className="rounded-xl bg-navy px-8 py-8">
        <h1 className="font-display text-3xl font-bold text-white leading-snug">{c.title}</h1>
        {c.description && (
          <p className="mt-3 font-body text-mist max-w-2xl">{c.description}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="inline-flex items-center rounded-md border border-amber/60 bg-amber/20 px-3 py-1 font-body text-sm font-medium text-amber">
            {c.ceu_hours} CEU hours
          </span>
          {c.accrediting_body && (
            <span className="inline-flex items-center rounded-md border border-mist/40 px-3 py-1 font-body text-sm text-mist">
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
            <div className="flex items-center justify-between rounded-xl border border-teal/30 bg-teal/5 px-6 py-4">
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
  return <main className="container space-y-6 py-8">{children}</main>;
}
