"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  useCourses,
  useEnroll,
  useLearnerProfile,
  useMe,
  useMyEnrollments,
} from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";

export default function CoursesPage() {
  const router = useRouter();
  const me = useMe();
  const profile = useLearnerProfile();
  const courses = useCourses();
  const enrollments = useMyEnrollments();
  const enroll = useEnroll();

  useEffect(() => {
    if (
      me.data &&
      profile.data &&
      Object.keys(profile.data.vark_scores ?? {}).length === 0
    ) {
      router.replace("/onboarding");
    }
  }, [me.data, profile.data, router]);

  if (me.isLoading) return <Shell>Loading…</Shell>;
  if (me.error) {
    return (
      <Shell>
        <p className="text-steel">
          Please{" "}
          <Link href="/login" className="text-amber-dim underline">
            sign in
          </Link>{" "}
          to view courses.
        </p>
      </Shell>
    );
  }

  const enrolledIds = new Set((enrollments.data ?? []).map((e) => e.course_id));

  return (
    <Shell>
      {/* Page header with amber underline accent */}
      <div className="pb-4 border-b-2 border-amber inline-block">
        <h1 className="font-display text-3xl font-bold text-navy">Course catalog</h1>
      </div>
      <p className="font-body text-steel">Enroll in a course to begin earning CEU hours.</p>

      {courses.isLoading && <p className="font-body text-steel">Loading courses…</p>}
      {courses.error && (
        <p className="text-error">Failed to load courses: {String(courses.error)}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(courses.data ?? []).map((course) => {
          const enrolled = enrolledIds.has(course.id);
          const stageColor = getStageColor(course.stage ?? "ce");
          return (
            <div
              key={course.id}
              className="flex flex-col rounded-xl border border-cloud bg-white shadow-card overflow-hidden"
            >
              {/* Stage color top bar */}
              <div className="h-1" style={{ backgroundColor: stageColor }} />
              <div className="flex flex-col flex-1 p-5 gap-4">
                <div className="flex-1">
                  <h2 className="font-display text-base font-semibold text-navy leading-snug">
                    {course.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 font-body text-sm text-steel">
                    {course.description ?? "No description."}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body text-xs uppercase tracking-[0.12em] text-steel">
                    {course.ceu_hours} CEU
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 font-body text-xs font-medium capitalize"
                    style={{ backgroundColor: stageColor + "1A", color: stageColor }}
                  >
                    {course.status}
                  </span>
                </div>
                {enrolled ? (
                  <Link
                    href={`/courses/${course.id}`}
                    className="inline-flex items-center justify-center rounded-md bg-amber px-4 py-2 text-sm font-medium text-white shadow-amber hover:bg-amber-light transition-colors"
                  >
                    Continue →
                  </Link>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => enroll.mutate(course.id)}
                    disabled={enroll.isPending}
                  >
                    {enroll.isPending ? "Enrolling…" : "Enroll"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function getStageColor(stage: string): string {
  const map: Record<string, string> = {
    "pre-college": "#4A80B5",
    vocational: "#0E7C7B",
    college: "#3D5A73",
    certif: "#4A7C6F",
    licensure: "#162D4A",
    ce: "#C98A2A",
  };
  return map[stage] ?? "#162D4A";
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="container space-y-6 py-10">{children}</main>;
}
