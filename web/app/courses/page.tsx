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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <p className="text-muted-foreground">
          Please{" "}
          <Link href="/login" className="underline">
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
      <h1 className="text-3xl font-bold tracking-tight">Course catalog</h1>
      <p className="text-muted-foreground">Enroll in a course to begin earning CEU hours.</p>
      {courses.isLoading && <p className="text-muted-foreground">Loading courses…</p>}
      {courses.error && (
        <p className="text-destructive">Failed to load courses: {String(courses.error)}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(courses.data ?? []).map((course) => {
          const enrolled = enrolledIds.has(course.id);
          return (
            <Card key={course.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">{course.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {course.description ?? "No description."}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{course.ceu_hours} CEU</span>
                  <span className="capitalize">{course.status}</span>
                </div>
                <div className="flex gap-2">
                  {enrolled ? (
                    <Link
                      href={`/courses/${course.id}`}
                      className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Continue →
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => enroll.mutate(course.id)}
                      disabled={enroll.isPending}
                    >
                      {enroll.isPending ? "Enrolling…" : "Enroll"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="container space-y-6 py-8">{children}</main>;
}
