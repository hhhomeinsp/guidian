"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useCertificate, useCourse, useMe } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Certificate } from "@/components/course";

export default function CertificateDetailPage({
  params,
}: {
  params: { certificateId: string };
}) {
  const cert = useCertificate(params.certificateId);
  const course = useCourse(cert.data?.course_id);
  const me = useMe();

  if (cert.isLoading || !cert.data) {
    return <main className="container py-12 text-muted-foreground">Loading…</main>;
  }

  const c = cert.data;

  return (
    <main className="container space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/certificates" className="text-sm text-muted-foreground hover:underline">
            ← All certificates
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Certificate</h1>
        </div>
        <div className="flex items-center gap-2">
          {c.status === "pending" && (
            <span className="rounded-md bg-amber-500/10 px-3 py-1 text-sm text-amber-700 dark:text-amber-300">
              Rendering PDF…
            </span>
          )}
          {c.status === "failed" && (
            <span className="rounded-md bg-destructive/10 px-3 py-1 text-sm text-destructive">
              Render failed
            </span>
          )}
          {c.status === "issued" && c.download_url && (
            <Button asChild>
              <a href={c.download_url} target="_blank" rel="noopener noreferrer">
                <Download className="mr-1 h-4 w-4" /> Download PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-8">
        <Certificate
          learnerName={me.data?.full_name || me.data?.email || "—"}
          courseTitle={course.data?.title ?? "—"}
          ceuHours={c.ceu_hours}
          issuedAt={c.issued_at}
          verificationCode={c.verification_code}
          accreditingBody={course.data?.accrediting_body ?? null}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        The on-screen preview is rendered from the component library. The authoritative
        PDF above is generated server-side by headless Chromium and stored in S3.
      </p>
    </main>
  );
}
