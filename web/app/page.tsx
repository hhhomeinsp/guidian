import Link from "next/link";

export default function Home() {
  return (
    <main className="container py-16 space-y-6">
      <h1 className="text-4xl font-bold">Guidian</h1>
      <p className="text-muted-foreground">
        AI-Native Adaptive Compliance LMS. Course player and adaptive renderer coming in build step 8.
      </p>
      <div className="flex gap-4">
        <Link
          href="/courses"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Browse courses →
        </Link>
        <Link
          href="/_dev/components"
          className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Component sandbox
        </Link>
      </div>
    </main>
  );
}
