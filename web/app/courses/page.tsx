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
  if (me.error || !me.data) {
    return (
      <Shell>
        <p className="text-[#6E6E73]">
          Please{" "}
          <Link href="/login" className="text-[#0071E3] underline">
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
      <div className="pb-4 border-b border-[#D2D2D7]">
        <h1 className="text-3xl font-bold text-[#1D1D1F]">Course catalog</h1>
      </div>
      <p className="text-[#6E6E73]">Enroll in a course to begin earning CEU hours.</p>

      {courses.isLoading && <p className="text-[#6E6E73]">Loading courses…</p>}
      {courses.error && (
        <p className="text-[#FF3B30]">Failed to load courses: {String(courses.error)}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(courses.data ?? []).map((course) => {
          const enrolled = enrolledIds.has(course.id);
          const stageColor = getStageColor(course.stage ?? "ce");
          return (
            <div
              key={course.id}
              className="flex flex-col rounded-[18px] bg-white overflow-hidden shadow-card"
              style={{ borderLeft: `4px solid ${stageColor}` }}
            >
              <div className="flex flex-col flex-1 p-5 gap-4">
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-[#1D1D1F] leading-snug">
                    {course.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm text-[#6E6E73]">
                    {course.description ?? "No description."}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: stageColor + "1A",
                      color: stageColor,
                    }}
                  >
                    {course.ceu_hours} CEU
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                    style={{
                      backgroundColor: stageColor + "1A",
                      color: stageColor,
                    }}
                  >
                    {course.status}
                  </span>
                </div>
                {enrolled ? (
                  <Link
                    href={`/courses/${course.id}`}
                    className="inline-flex items-center justify-center rounded-[10px] bg-[#0071E3] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0077ED]"
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
    "pre-college": "#5E5CE6",
    vocational: "#30B0C7",
    college: "#0071E3",
    certif: "#34C759",
    licensure: "#1D1D1F",
    ce: "#FF9F0A",
  };
  return map[stage] ?? "#0071E3";
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="container space-y-6 py-10">{children}</main>;
}
