"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { apiFetch, getAccessToken } from "@/lib/api/client";
import { useOpportunities, useGenerateCourse } from "@/lib/api/hooks";

interface ChatMesnova {
  role: "user" | "assistant";
  content: string;
}

interface CourseSpec {
  title: string;
  description: string;
  ceu_hours: number;
  target_audience: string;
  compliance_requirement: string;
  accrediting_body: string;
  num_modules: number;
  lessons_per_module: number;
  state_approvals: string[];
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

const INITIAL_MESNOVA: ChatMesnova = {
  role: "assistant",
  content:
    "Hi! Let's build a new course. What profession and state are you targeting? For example: Florida real estate agents needing ethics CE, or Texas home inspectors renewing annual CE.",
};

function CourseChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const opportunityId = searchParams.get("opportunity");

  const { data: opportunities } = useOpportunities();
  const generateCourse = useGenerateCourse();

  const [mesnovas, setMesnovas] = useState<ChatMesnova[]>([INITIAL_MESNOVA]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [spec, setSpec] = useState<CourseSpec | null>(null);
  const mesnovasEndRef = useRef<HTMLDivElement>(null);

  const opportunity = opportunities?.find((o) => o.id === opportunityId);

  useEffect(() => {
    if (opportunity) {
      const contextMsg: ChatMesnova = {
        role: "user",
        content: `I want to build this course from our pipeline: "${opportunity.title}". Profession: ${opportunity.profession.replace(/_/g, " ")}. States: ${opportunity.target_states.join(", ")}. CEU hours: ${opportunity.ceu_hours}. ${opportunity.notes ? `Notes: ${opportunity.notes}` : ""}`,
      };
      setMesnovas([INITIAL_MESNOVA, contextMsg]);
      sendMesnovas([INITIAL_MESNOVA, contextMsg], opportunity.id);
    }
  }, [opportunity?.id]);

  useEffect(() => {
    mesnovasEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mesnovas]);

  async function sendMesnovas(msgs: ChatMesnova[], oppId?: string) {
    setIsStreaming(true);
    const assistantMsg: ChatMesnova = { role: "assistant", content: "" };
    setMesnovas((prev) => [...prev, assistantMsg]);

    try {
      const token = getAccessToken();
      const res = await fetch(`${BASE_URL}/admin/course-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mesnovas: msgs.filter((m) => m.content.trim()),
          opportunity_id: oppId ?? opportunityId ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`API error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.text) {
              setMesnovas((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: updated[updated.length - 1].content + payload.text,
                };
                return updated;
              });
            }
            if (payload.ready && payload.spec) {
              setSpec(payload.spec);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setMesnovas((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSend() {
    if (!input.trim() || isStreaming) return;
    const userMsg: ChatMesnova = { role: "user", content: input.trim() };
    const updatedMesnovas = [...mesnovas, userMsg];
    setMesnovas(updatedMesnovas);
    setInput("");
    sendMesnovas(updatedMesnovas);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleGenerate() {
    if (!spec) return;
    try {
      await generateCourse.mutateAsync({
        prompt: spec.title,
        target_audience: spec.target_audience,
        compliance_requirement: spec.compliance_requirement,
        ceu_hours: spec.ceu_hours,
        num_modules: spec.num_modules,
        lessons_per_module: spec.lessons_per_module,
        accrediting_body: spec.accrediting_body,
      });
      router.push("/admin/ai-jobs");
    } catch {
      // error displayed by mutation
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy">New Course (Chat)</h1>
        <p className="font-body text-steel mt-1">
          Describe what you want to build — Guidian will design the course for you.
        </p>
      </div>

      <div className="flex gap-4 h-[70vh]">
        {/* Chat panel */}
        <div className="flex flex-col flex-[3] rounded-[18px] border border-[#D2D2D7] bg-white shadow-card overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mesnovas.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-[14px] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[#0071E3] text-white"
                      : "bg-[#F5F5F7] text-[#1D1D1F]"
                  }`}
                >
                  {msg.content}
                  {idx === mesnovas.length - 1 && isStreaming && msg.role === "assistant" && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />
                  )}
                </div>
              </div>
            ))}
            <div ref={mesnovasEndRef} />
          </div>

          <div className="border-t border-[#D2D2D7] p-3 flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Type a mesnova… (Enter to send)"
              rows={2}
              className="flex-1 resize-none rounded-[10px] border border-[#D2D2D7] px-3 py-2 text-sm text-[#1D1D1F] placeholder:text-[#6E6E73] focus:outline-none focus:ring-2 focus:ring-[#0071E3] disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              className="rounded-[10px] bg-[#0071E3] p-2.5 text-white transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Spec panel */}
        <div className="flex flex-col flex-[2] rounded-[18px] border border-[#D2D2D7] bg-white shadow-card overflow-hidden">
          <div className="border-b border-[#D2D2D7] px-4 py-3">
            <h2 className="font-semibold text-[#1D1D1F]">Course Outline</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!spec ? (
              <p className="font-body text-sm text-[#6E6E73]">
                The course outline will appear here once the AI has gathered enough information.
              </p>
            ) : (
              <div className="space-y-3 text-sm">
                <SpecRow label="Title" value={spec.title} />
                <SpecRow label="Description" value={spec.description} />
                <SpecRow label="CEU Hours" value={String(spec.ceu_hours)} />
                <SpecRow label="Audience" value={spec.target_audience} />
                <SpecRow label="Compliance" value={spec.compliance_requirement} />
                <SpecRow label="Accrediting Body" value={spec.accrediting_body} />
                <SpecRow label="Modules" value={String(spec.num_modules)} />
                <SpecRow label="Lessons / Module" value={String(spec.lessons_per_module)} />
                {spec.state_approvals.length > 0 && (
                  <SpecRow label="States" value={spec.state_approvals.join(", ")} />
                )}
              </div>
            )}
          </div>
          {spec && (
            <div className="border-t border-[#D2D2D7] p-4">
              <button
                onClick={handleGenerate}
                disabled={generateCourse.isPending}
                className="w-full rounded-[10px] bg-[#0071E3] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {generateCourse.isPending ? "Queuing…" : "Generate Course"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#6E6E73] uppercase tracking-wide">{label}</p>
      <p className="text-[#1D1D1F] mt-0.5">{value}</p>
    </div>
  );
}

export default function CourseChatPage() {
  return (
    <Suspense fallback={<p className="font-body text-steel">Loading…</p>}>
      <CourseChatInner />
    </Suspense>
  );
}
