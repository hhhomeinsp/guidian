"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, clearTokens, getAccessToken, storeTokens } from "./client";
import type {
  AIJobRead,
  AdminMetrics,
  AuditLogRead,
  BehavioralSignalBatch,
  CCGenerateRequest,
  CCJobStatus,
  CEURuleCreate,
  CEURuleRead,
  CEURuleUpdate,
  CertificateRead,
  ComplianceDecision,
  Course,
  CourseGenerationRequest,
  Enrollment,
  GenerationJobRead,
  IdentityVerifyRequest,
  LearnerMemoryRead,
  LearnerProfile,
  Lesson,
  LessonProgressRead,
  LessonProgressUpdate,
  OpportunityRead,
  OpportunityUpdate,
  QuizAttemptRead,
  QuizAttemptRequest,
  QuizAttemptsSummary,
  StateRequirementRead,
  SubmissionCreate,
  SubmissionRead,
  SubmissionUpdate,
  TokenPair,
  UserRead,
  VARKSubmission,
  XAPIStatementRead,
} from "./schema";

// --- Auth ---
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<UserRead>("/users/me"),
    retry: false,
    enabled: !!getAccessToken(),
    staleTime: 30000,
    gcTime: 0,
  });
}

export function useUpdateIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IdentityVerifyRequest) =>
      apiFetch<UserRead>("/users/me/identity", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<TokenPair>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (pair) => {
      storeTokens(pair);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: {
      email: string;
      password: string;
      full_name?: string;
      organization_slug?: string;
    }) => apiFetch<UserRead>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function logout() {
  clearTokens();
  if (typeof window !== "undefined") window.location.href = "/login";
}

// --- Courses ---
export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: () => apiFetch<Course[]>("/courses"),
  });
}

export function useCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ["course", courseId],
    queryFn: () => apiFetch<Course>(`/courses/${courseId}`),
    enabled: !!courseId,
  });
}

export function useLesson(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => apiFetch<Lesson>(`/courses/lessons/${lessonId}`),
    enabled: !!lessonId,
  });
}

// --- Enrollments ---
export function useMyEnrollments() {
  return useQuery({
    queryKey: ["enrollments", "me"],
    queryFn: () => apiFetch<Enrollment[]>("/enrollments/me"),
  });
}

export function useEnroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (course_id: string) =>
      apiFetch<Enrollment>("/enrollments", {
        method: "POST",
        body: JSON.stringify({ course_id }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrollments", "me"] }),
  });
}

// --- Lesson progress ---
export function useLessonProgress(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["progress", lessonId],
    queryFn: () => apiFetch<LessonProgressRead | null>(`/lessons/${lessonId}/progress`),
    enabled: !!lessonId,
  });
}

// --- Quiz ---
export function useQuizSummary(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["quiz", "summary", lessonId],
    queryFn: () => apiFetch<QuizAttemptsSummary>(`/lessons/${lessonId}/quiz/summary`),
    enabled: !!lessonId,
  });
}

export function useSubmitQuiz(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: QuizAttemptRequest) =>
      apiFetch<QuizAttemptRead>(`/lessons/${lessonId}/quiz/attempts`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz", "summary", lessonId] });
      qc.invalidateQueries({ queryKey: ["learner", "profile"] });
    },
  });
}

// --- Certificates ---
export function useMyCertificates() {
  return useQuery({
    queryKey: ["certificates", "me"],
    queryFn: () => apiFetch<CertificateRead[]>("/certificates/me"),
  });
}

export function useCertificate(certificateId: string | undefined) {
  return useQuery({
    queryKey: ["certificate", certificateId],
    queryFn: () => apiFetch<CertificateRead>(`/certificates/${certificateId}`),
    enabled: !!certificateId,
    // Poll until issued (or failed)
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return data.status === "pending" ? 2500 : false;
    },
  });
}

export function useIssueCertificate(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<CertificateRead>(`/courses/${courseId}/certificates/issue`, {
        method: "POST",
      }),
    onSuccess: (cert) => {
      qc.setQueryData(["certificate", cert.id], cert);
      qc.invalidateQueries({ queryKey: ["certificates", "me"] });
    },
  });
}

// --- Admin ---
export function useAdminMetrics() {
  return useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: () => apiFetch<AdminMetrics>("/admin/metrics"),
    refetchInterval: 15_000,
  });
}

export function useAuditEvents(params: {
  event_type?: string;
  subject_user_id?: string;
  course_id?: string;
  limit?: number;
} = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") search.set(k, String(v));
  });
  const qs = search.toString();
  return useQuery({
    queryKey: ["admin", "audit", qs],
    queryFn: () => apiFetch<AuditLogRead[]>(`/admin/audit${qs ? `?${qs}` : ""}`),
  });
}

export function useAIJobs(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["admin", "ai-jobs", status ?? ""],
    queryFn: () => apiFetch<AIJobRead[]>(`/admin/ai-jobs${qs}`),
    refetchInterval: 5_000,
  });
}

export function useAdminUsers(limit = 100) {
  return useQuery({
    queryKey: ["admin", "users", limit],
    queryFn: () => apiFetch<UserRead[]>(`/users?limit=${limit}`),
  });
}

export function useCEURuleForCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "ceu-rule", courseId],
    queryFn: () =>
      apiFetch<CEURuleRead | null>(`/admin/ceu-rules/course/${courseId}`),
    enabled: !!courseId,
  });
}

export function useCreateCEURule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CEURuleCreate) =>
      apiFetch<CEURuleRead>("/admin/ceu-rules", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (rule) => {
      qc.invalidateQueries({ queryKey: ["admin", "ceu-rule", rule.course_id] });
    },
  });
}

export function useUpdateCEURule(ruleId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CEURuleUpdate) =>
      apiFetch<CEURuleRead>(`/admin/ceu-rules/${ruleId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "ceu-rule", courseId] }),
  });
}

export function useGenerateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CourseGenerationRequest) =>
      apiFetch<GenerationJobRead>("/ai/courses/generate", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "ai-jobs"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}

// --- xAPI ---
export function useMyStatements(limit = 50) {
  return useQuery({
    queryKey: ["xapi", "me", limit],
    queryFn: () =>
      apiFetch<XAPIStatementRead[]>(`/xapi/statements/me?limit=${limit}`),
  });
}

// --- Compliance ---
export function useCompliance(courseId: string | undefined) {
  return useQuery({
    queryKey: ["compliance", courseId],
    queryFn: () => apiFetch<ComplianceDecision>(`/courses/${courseId}/compliance`),
    enabled: !!courseId,
  });
}

// --- Learner profile ---
export function useLearnerProfile() {
  return useQuery({
    queryKey: ["learner", "profile"],
    queryFn: () => apiFetch<LearnerProfile>("/learner/profile"),
    retry: false,
  });
}

export function useSubmitVark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VARKSubmission) =>
      apiFetch<LearnerProfile>("/learner/profile/vark", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => qc.setQueryData(["learner", "profile"], data),
  });
}

// --- Opportunities ---
export function useOpportunities() {
  return useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: () => apiFetch<OpportunityRead[]>("/opportunities"),
  });
}

export function useUpdateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: OpportunityUpdate }) =>
      apiFetch<OpportunityRead>(`/opportunities/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "opportunities"] }),
  });
}

// --- State requirements ---
export function useStateRequirements() {
  return useQuery({
    queryKey: ["compliance", "states"],
    queryFn: () => apiFetch<StateRequirementRead[]>("/compliance/states"),
  });
}

// --- Compliance submissions ---
export function useComplianceSubmissions() {
  return useQuery({
    queryKey: ["compliance", "submissions"],
    queryFn: () => apiFetch<SubmissionRead[]>("/compliance/submissions"),
  });
}

export function useCreateSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmissionCreate) =>
      apiFetch<SubmissionRead>("/compliance/submissions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance", "submissions"] }),
  });
}

export function useUpdateSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SubmissionUpdate }) =>
      apiFetch<SubmissionRead>(`/compliance/submissions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance", "submissions"] }),
  });
}

export function useSendSignals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BehavioralSignalBatch) =>
      apiFetch<LearnerProfile>("/learner/signals", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => qc.setQueryData(["learner", "profile"], data),
  });
}

// --- Billing / Subscription ---
export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () =>
      apiFetch<{ plan: string; status: string; current_period_end: string | null }>(
        "/billing/subscription"
      ).catch(() => ({ plan: "free", status: "active", current_period_end: null })),
    enabled: !!getAccessToken(),
    retry: false,
    staleTime: 60000,
  });
}

export function useUpdateLessonProgress(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LessonProgressUpdate) =>
      apiFetch<LessonProgressRead>(`/lessons/${lessonId}/progress`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["progress", lessonId] }),
  });
}

// --- CC Max plan generation ---
export function useCCGenerateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CCGenerateRequest) =>
      apiFetch<{ job_id: string; status: string }>("/admin/cc-generate-course", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}

export function useCCJob(jobId: string | null) {
  return useQuery({
    queryKey: ["admin", "cc-jobs", jobId],
    queryFn: () => apiFetch<CCJobStatus>(`/admin/cc-jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
}

// --- AI Teacher ---
export function useLearnerMemory() {
  return useQuery({
    queryKey: ["teacher-memory"],
    queryFn: () => apiFetch<LearnerMemoryRead>("/teacher/memory"),
    enabled: !!getAccessToken(),
    retry: false,
  });
}
