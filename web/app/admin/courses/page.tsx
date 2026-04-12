"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useCourses } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminCoursesPage() {
  const courses = useCourses();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
          <p className="text-muted-foreground">
            Author, edit, and review courses. Run the AI generator for a new course.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="mr-1 h-4 w-4" /> Generate course
          </Link>
        </Button>
      </div>

      {courses.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {courses.data && courses.data.length === 0 && (
        <p className="text-muted-foreground">
          No courses yet. Run the AI generator to create your first one.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(courses.data ?? []).map((course) => (
          <Link key={course.id} href={`/admin/courses/${course.id}`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle className="text-base">{course.title}</CardTitle>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {course.status}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {course.description ?? "No description."}
                </p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{course.ceu_hours} CEU</span>
                  <span>v{course.version}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
