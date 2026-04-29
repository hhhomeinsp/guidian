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
    return <main className="container py-12 font-body text-steel">Loading…</main>;
  }

  const c = cert.data;

  return (
    <main className="container space-y-6 py-8 min-h-screen bg-[#F5F5F7]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/certificates" className="font-body text-sm text-amber hover:underline">
            ← All certificates
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-navy">Certificate</h1>
        </div>
        <div className="flex items-center gap-2">
          {c.status === "pending" && (
            <span className="rounded-lg bg-warning-bg px-3 py-1.5 font-body text-sm font-medium text-warning">
              Rendering PDF…
            </span>
          )}
          {c.status === "failed" && (
            <span className="rounded-lg bg-error-bg px-3 py-1.5 font-body text-sm font-medium text-error">
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

      <div className="rounded-xl border border-cloud bg-fog p-8">
        <Certificate
          learnerName={me.data?.full_name || me.data?.email || "—"}
          courseTitle={course.data?.title ?? "—"}
          ceuHours={c.ceu_hours}
          issuedAt={c.issued_at}
          verificationCode={c.verification_code}
          accreditingBody={course.data?.accrediting_body ?? null}
        />
      </div>

      <p className="text-center font-body text-xs text-steel">
        The on-screen preview is rendered from the component library. The authoritative
        PDF above is generated server-side by headless Chromium and stored in S3.
      </p>
    </main>
  );
}
