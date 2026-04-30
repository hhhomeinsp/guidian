"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  useCourses,
  useLearnerProfile,
  useMe,
} from "@/lib/api/hooks";
import { apiFetch, getAccessToken } from "@/lib/api/client";
import { formatPriceUSD, priceForSlug } from "@/lib/pricing";

interface MyCoursesResponse {
  course_ids: string[];
}

export default function CoursesPage() {
  const router = useRouter();
  const me = useMe();
  const profile = useLearnerProfile();
  const courses = useCourses();
  const myCourses = useQuery({
    queryKey: ["billing", "my-courses"],
    queryFn: () => apiFetch<MyCoursesResponse>("/billing/my-courses"),
    enabled: !!getAccessToken(),
    retry: false,
  });
  const [query, setQuery] = useState("");
  const [buyingCourseId, setBuyingCourseId] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    if (
      me.data &&
      profile.data &&
      Object.keys(profile.data.vark_scores ?? {}).length === 0
    ) {
      router.replace("/onboarding");
    }
  }, [me.data, profile.data, router]);

  const ownedIds = useMemo(
    () => new Set(myCourses.data?.course_ids ?? []),
    [myCourses.data],
  );

  const filteredCourses = useMemo(() => {
    const list = courses.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const title = (c.title ?? "").toLowerCase();
      const desc = (c.description ?? "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [courses.data, query]);

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

  const isAdmin = me.data?.role === "admin";

  async function handleBuy(courseId: string) {
    setBuyError(null);
    setBuyingCourseId(courseId);
    try {
      const res = await apiFetch<{ checkout_url: string | null; message?: string }>(
        "/billing/course/checkout",
        {
          method: "POST",
          body: JSON.stringify({ course_id: courseId }),
        },
      );
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      if (res.message === "already_owned") {
        router.push(`/courses/${courseId}`);
        return;
      }
      setBuyError("Could not start checkout. Try again.");
    } catch {
      setBuyError("Could not start checkout. Try again.");
    } finally {
      setBuyingCourseId(null);
    }
  }

  return (
    <Shell>
      <div className="pb-4 border-b border-[#D2D2D7]">
        <h1 className="text-3xl font-bold text-[#1D1D1F]">Course catalog</h1>
      </div>
      <p className="text-[#6E6E73]">
        Buy a course once and own it forever. Add Pro for Nova AI on every course you own.
      </p>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E6E73]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses..."
          aria-label="Search courses"
          className="w-full bg-white border border-[#D2D2D7] rounded-xl pl-11 pr-4 py-3 text-[#1D1D1F] placeholder:text-[#6E6E73] focus:outline-none focus:border-[#0071E3]"
        />
      </div>

      {courses.isLoading && <p className="text-[#6E6E73]">Loading courses…</p>}
      {courses.error && (
        <p className="text-[#FF3B30]">Failed to load courses: {String(courses.error)}</p>
      )}
      {buyError && <p className="text-[#FF3B30] text-sm">{buyError}</p>}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCourses.map((course) => {
          const owned = isAdmin || ownedIds.has(course.id);
          const priceCents = priceForSlug(course.slug);
          const priceLabel = formatPriceUSD(priceCents);
          const buying = buyingCourseId === course.id;
          return (
            <div
              key={course.id}
              className="flex flex-col rounded-2xl bg-white overflow-hidden shadow-card"
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
                      backgroundColor: "rgba(22,45,74,0.08)",
                      color: "#162D4A",
                    }}
                  >
                    {course.ceu_hours} CEU
                  </span>
                  {!owned && (
                    <span className="text-sm font-semibold text-[#1D1D1F]">
                      {priceLabel}
                    </span>
                  )}
                  {owned && (
                    <span className="rounded-full bg-[#34C759]/15 px-2.5 py-0.5 text-xs font-medium text-[#0E7C2D]">
                      Owned
                    </span>
                  )}
                </div>
                {owned ? (
                  <Link
                    href={`/courses/${course.id}`}
                    className="inline-flex items-center justify-center rounded-full bg-[#0071E3] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0077ED]"
                  >
                    Continue Learning →
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBuy(course.id)}
                    disabled={buying}
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#0071E3] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0077ED] disabled:opacity-60"
                  >
                    {buying ? "Starting checkout…" : `Buy — ${priceLabel}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="container space-y-6 py-10 min-h-screen bg-[#F5F5F7]">{children}</main>;
}
