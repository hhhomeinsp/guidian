"use client";

import Link from "next/link";
import {
  useCompliance,
  useCourse,
  useIssueCertificate,
  useMyCertificates,
} from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{c.title}</h1>
        <p className="mt-2 text-muted-foreground">{c.description}</p>
        <div className="mt-3 flex gap-3 text-sm text-muted-foreground">
          <span>{c.ceu_hours} CEU</span>
          {c.accrediting_body && <span>· {c.accrediting_body}</span>}
        </div>
      </div>

      <div className="space-y-6">
        {modules.map((m, mi) => (
          <Card key={m.id}>
            <CardHeader>
              <CardTitle>
                Module {mi + 1}: {m.title}
              </CardTitle>
              {m.description && (
                <p className="text-sm text-muted-foreground">{m.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {m.lessons.map((l, li) => (
                <Link
                  key={l.id}
                  href={`/courses/${c.id}/lessons/${l.id}`}
                  className="block rounded-md border border-border p-3 text-sm transition-colors hover:bg-accent"
                >
                  <span className="text-muted-foreground">{mi + 1}.{li + 1}</span>{" "}
                  <span className="font-medium">{l.title}</span>
                  <span className="float-right text-xs text-muted-foreground">
                    {l.clock_minutes} min
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {compliance.data ? (
        <div className="space-y-4">
          <CompliancePanel decision={compliance.data} />
          {compliance.data.eligible && (
            <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="text-sm">
                <p className="font-semibold">
                  {existingCert
                    ? existingCert.status === "issued"
                      ? "Your certificate is ready."
                      : existingCert.status === "pending"
                        ? "Rendering your certificate…"
                        : "Certificate render failed."
                    : "You're ready to claim your certificate."}
                </p>
                {existingCert?.status === "issued" && (
                  <p className="text-muted-foreground">
                    Verification code:{" "}
                    <span className="font-mono">{existingCert.verification_code}</span>
                  </p>
                )}
              </div>
              {existingCert ? (
                <Link
                  href={`/certificates/${existingCert.id}`}
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  View certificate →
                </Link>
              ) : (
                <Button
                  onClick={() => issue.mutate()}
                  disabled={issue.isPending}
                >
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
  return <main className="container space-y-8 py-8">{children}</main>;
}
