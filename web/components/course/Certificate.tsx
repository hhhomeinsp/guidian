import * as React from "react";
import { GuidianLogo } from "@/components/ui/GuidianLogo";
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
 * Puppeteer and stored in S3. This component is for on-screen preview and
 * @media print only — never used to produce the canonical PDF.
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
        "relative mx-auto max-w-3xl rounded-xl bg-navy p-12 text-center shadow-xl print:shadow-none",
        className,
      )}
      style={{ borderTop: "6px solid #C98A2A" }}
    >
      {/* Logo */}
      <div className="flex justify-center mb-4">
        <GuidianLogo size={44} strokeColor="white" accentColor="#C98A2A" />
      </div>

      <p className="font-body text-xs uppercase tracking-[0.3em] text-amber mb-1">
        Guidian
      </p>
      <p className="font-body text-xs uppercase tracking-[0.25em] text-mist">
        Certificate of Completion
      </p>

      <div className="my-8 h-px bg-amber/30" />

      <h2 className="font-body text-sm text-mist">This certifies that</h2>
      <p className="mt-3 font-display text-4xl font-bold text-white tracking-tight italic">
        {learnerName}
      </p>
      <h2 className="mt-6 font-body text-sm text-mist">has successfully completed</h2>
      <p className="mt-2 font-display text-2xl font-semibold text-white">{courseTitle}</p>
      <p className="mt-5 font-body text-base text-mist">
        earning{" "}
        <span className="font-semibold text-amber">{ceuHours} CEU hours</span>
        {accreditingBody && (
          <>
            {" "}accredited by{" "}
            <span className="font-semibold text-white">{accreditingBody}</span>
          </>
        )}
      </p>

      <div className="my-8 h-px bg-amber/30" />

      <div className="flex justify-between font-body text-sm">
        <div className="text-left">
          <p className="font-semibold text-white">{date}</p>
          <p className="text-mist text-xs">Date of completion</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs text-amber">{verificationCode}</p>
          <p className="text-mist text-xs">Verification code</p>
        </div>
      </div>
    </div>
  );
}
