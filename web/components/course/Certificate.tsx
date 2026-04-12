import * as React from "react";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CertificateProps {
  learnerName: string;
  courseTitle: string;
  ceuHours: number;
  issuedAt: string; // ISO
  verificationCode: string;
  accreditingBody?: string | null;
  className?: string;
}

/**
 * Display-only certificate. The authoritative PDF is generated server-side via
 * Puppeteer and stored in S3 (build step 12). This component is for on-screen
 * preview and @media print styles only — never used to produce the canonical PDF.
 */
export function Certificate({
  learnerName,
  courseTitle,
  ceuHours,
  issuedAt,
  verificationCode,
  accreditingBody,
  className,
}: CertificateProps) {
  const date = new Date(issuedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className={cn(
        "relative mx-auto max-w-3xl rounded-xl border-4 border-primary/20 bg-card p-12 text-center shadow-xl print:border-2 print:shadow-none",
        className,
      )}
    >
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Award className="h-9 w-9 text-primary" aria-hidden />
      </div>
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Certificate of Completion</p>
      <h1 className="mt-6 text-lg text-muted-foreground">This certifies that</h1>
      <p className="mt-2 text-4xl font-serif font-bold tracking-tight">{learnerName}</p>
      <h2 className="mt-6 text-lg text-muted-foreground">has successfully completed</h2>
      <p className="mt-2 text-2xl font-semibold">{courseTitle}</p>
      <p className="mt-6 text-lg">
        earning <span className="font-semibold">{ceuHours} CEU hours</span>
        {accreditingBody && (
          <>
            {" "}
            accredited by <span className="font-semibold">{accreditingBody}</span>
          </>
        )}
      </p>
      <div className="mt-10 flex justify-between text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">{date}</p>
          <p>Date of completion</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs text-foreground">{verificationCode}</p>
          <p>Verification code</p>
        </div>
      </div>
    </div>
  );
}
