"use client";

import Link from "next/link";
import { useMyCertificates } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CertificatesListPage() {
  const certs = useMyCertificates();

  return (
    <main className="container space-y-6 py-8">
      <h1 className="text-3xl font-bold tracking-tight">My certificates</h1>
      {certs.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {certs.data && certs.data.length === 0 && (
        <p className="text-muted-foreground">
          No certificates yet. Complete a course to earn one.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(certs.data ?? []).map((cert) => (
          <Link key={cert.id} href={`/certificates/${cert.id}`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle className="text-base">
                  {cert.ceu_hours} CEU ·{" "}
                  <span className="capitalize text-muted-foreground text-sm">{cert.status}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>
                  Issued{" "}
                  {new Date(cert.issued_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="font-mono text-xs">{cert.verification_code}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
