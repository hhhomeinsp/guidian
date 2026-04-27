"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useCourses } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";

export default function AdminCoursesPage() {
  const courses = useCourses();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Courses</h1>
          <p className="font-body text-steel">
            Author, edit, and review courses. Run the AI generator for a new course.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="mr-1 h-4 w-4" /> Generate course
          </Link>
        </Button>
      </div>

      {courses.isLoading && <p className="font-body text-steel">Loading…</p>}
      {courses.data && courses.data.length === 0 && (
        <p className="font-body text-steel">
          No courses yet. Run the AI generator to create your first one.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(courses.data ?? []).map((course) => (
          <Link key={course.id} href={`/admin/courses/${course.id}`}>
            <div className="h-full rounded-xl border border-cloud bg-white shadow-card transition-shadow hover:shadow-card-hover">
              <div className="border-b border-cloud px-5 py-4">
                <h2 className="font-display text-base font-semibold text-navy leading-snug">
                  {course.title}
                </h2>
                <p className="mt-1 font-body text-xs uppercase tracking-[0.12em] text-steel">
                  {course.status}
                </p>
              </div>
              <div className="px-5 py-4 space-y-2">
                <p className="line-clamp-3 font-body text-sm text-steel">
                  {course.description ?? "No description."}
                </p>
                <div className="flex justify-between font-body text-xs text-steel">
                  <span>{course.ceu_hours} CEU</span>
                  <span>v{course.version}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
