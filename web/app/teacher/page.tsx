"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useLearnerMemory, useMe } from "@/lib/api/hooks";
import { getAccessToken } from "@/lib/api/client";
import { API_BASE, streamSSE } from "@/lib/api/sse";
import { useSageContext } from "@/components/SageProvider";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function TeacherPageInner() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("course");
  const lessonTitle = searchParams.get("lesson");

  const me = useMe();
  const memory = useLearnerMemory();
  const { setSageContext, activateSage } = useSageContext();

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const hasGreeted = React.useRef(false);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendChat = React.useCallback(
    async (msgs: ChatMessage[]) => {
      const token = getAccessToken();
      if (!token) return;
      setIsLoading(true);
      const assistantId = `a-${Date.now()}`;
      let content = "";
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);
      try {
        const apiMessages = msgs.map(({ role, content }) => ({ role, content }));
        const body: { messages: typeof apiMessages; course_id?: string } = {
          messages: apiMessages,
        };
        if (courseId) body.course_id = courseId;
        for await (const chunk of streamSSE(`${API_BASE}/teacher/chat`, body, token)) {
          if (chunk.text) {
            content += chunk.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content } : m)),
            );
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Sorry, I'm having trouble connecting. Please try again.",
                }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [courseId],
  );

  // Fire greeting once auth is loaded and token is available
  React.useEffect(() => {
    if (hasGreeted.current) return;
    const token = getAccessToken();
    if (!token) return; // wait for auth to load
    hasGreeted.current = true;
    sendChat([]);
  }, [sendChat, me.data]); // re-run when me.data loads (auth confirmed)

  // Set Sage context to current course/lesson when on this page
  React.useEffect(() => {
    if (courseId || lessonTitle) {
      setSageContext(courseId, lessonTitle);
    }
    return () => setSageContext(null, null);
  }, [courseId, lessonTitle, setSageContext]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    setInput("");
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    await sendChat(nextMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const mem = memory.data;
  const renewalDays =
    mem?.renewal_deadline
      ? Math.ceil(
          (new Date(mem.renewal_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )
      : null;

  return (
    <div className="container py-6 max-w-6xl">
      <div className="flex gap-6" style={{ height: "calc(100vh - 8rem)" }}>
        {/* Left: Chat (65%) */}
        <div className="flex flex-col flex-[65] min-w-0 bg-white rounded-2xl border border-[#D2D2D7] shadow-sm overflow-hidden">
          {/* Header */}
          <div className="shrink-0 border-b border-[#D2D2D7] px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-base font-semibold text-[#1D1D1F]">Sage — AI Instructor</h1>
                {me.data && (
                  <p className="text-xs text-[#86868B] mt-0.5">
                    {me.data.full_name ?? me.data.email}
                    {mem?.profession ? ` · ${mem.profession}` : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(courseId || lessonTitle) && (
                  <span className="rounded-full bg-[#E8F2FD] text-[#0071E3] text-xs font-medium px-3 py-1">
                    {lessonTitle ? `Studying: ${lessonTitle}` : "Course context active"}
                  </span>
                )}
                {activateSage && (
                  <button
                    onClick={activateSage}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white transition-colors"
                    style={{ background: "linear-gradient(135deg, #162D4A 0%, #0E7C7B 100%)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <rect x="3" y="8" width="2" height="8" rx="1" />
                      <rect x="7" y="5" width="2" height="14" rx="1" />
                      <rect x="11" y="3" width="2" height="18" rx="1" />
                      <rect x="15" y="5" width="2" height="14" rx="1" />
                      <rect x="19" y="8" width="2" height="8" rx="1" />
                    </svg>
                    Switch to Voice
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#0071E3] text-white"
                      : "bg-[#F5F5F7] text-[#1D1D1F]"
                  }`}
                  style={{ fontFamily: "Inter, system-ui, sans-serif" }}
                >
                  {msg.content || (isLoading ? <TypingDots /> : null)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-[#D2D2D7] bg-white px-5 py-4">
            <div className="flex gap-3 items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Sage anything…"
                disabled={isLoading}
                className="flex-1 rounded-full border border-[#D2D2D7] bg-[#F5F5F7] px-4 py-2.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] outline-none focus:ring-2 focus:ring-[#0071E3]/30 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="rounded-full bg-[#0071E3] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0077ED] active:bg-[#006FD6] disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right: Learner snapshot (35%) */}
        <div className="hidden md:flex flex-[35] min-w-0 flex-col gap-4">
          {/* Profile card */}
          <div className="bg-white rounded-2xl border border-[#D2D2D7] shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[#1D1D1F] mb-3">Learner Profile</h2>
            {memory.isLoading ? (
              <p className="text-xs text-[#86868B]">Loading…</p>
            ) : mem ? (
              <dl className="space-y-3">
                {mem.profession && (
                  <div>
                    <dt className="text-[10px] font-medium text-[#86868B] uppercase tracking-widest">
                      Profession
                    </dt>
                    <dd className="text-sm font-medium text-[#1D1D1F] mt-0.5">{mem.profession}</dd>
                  </div>
                )}
                {mem.license_state && (
                  <div>
                    <dt className="text-[10px] font-medium text-[#86868B] uppercase tracking-widest">
                      License State
                    </dt>
                    <dd className="text-sm text-[#1D1D1F] mt-0.5">{mem.license_state}</dd>
                  </div>
                )}
                {mem.renewal_deadline && (
                  <div>
                    <dt className="text-[10px] font-medium text-[#86868B] uppercase tracking-widest">
                      Next Renewal
                    </dt>
                    <dd className="text-sm text-[#1D1D1F] mt-0.5">
                      {new Date(mem.renewal_deadline).toLocaleDateString()}{" "}
                      {renewalDays !== null && (
                        <span
                          className={`text-xs font-medium ${
                            renewalDays < 30 ? "text-red-500" : "text-[#86868B]"
                          }`}
                        >
                          ({renewalDays}d)
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {mem.total_sessions > 0 && (
                  <div>
                    <dt className="text-[10px] font-medium text-[#86868B] uppercase tracking-widest">
                      Sessions
                    </dt>
                    <dd className="text-sm text-[#1D1D1F] mt-0.5">{mem.total_sessions}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-xs text-[#86868B]">No profile data yet.</p>
            )}
          </div>

          {/* Strengths / Focus areas */}
          {mem && (mem.strengths?.length > 0 || mem.struggle_areas?.length > 0) && (
            <div className="bg-white rounded-2xl border border-[#D2D2D7] shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#1D1D1F]">Learning Snapshot</h2>
              {mem.strengths?.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-[#86868B] uppercase tracking-widest mb-2">
                    Strengths
                  </p>
                  <ul className="space-y-1.5">
                    {mem.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-[#1D1D1F] flex gap-1.5 items-start">
                        <span className="text-green-500 shrink-0">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {mem.struggle_areas?.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-[#86868B] uppercase tracking-widest mb-2">
                    Focus Areas
                  </p>
                  <ul className="space-y-1.5">
                    {mem.struggle_areas.map((s, i) => (
                      <li key={i} className="text-xs text-[#1D1D1F] flex gap-1.5 items-start">
                        <span className="text-amber-500 shrink-0">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Long-term summary */}
          {mem?.long_term_summary && (
            <div className="bg-white rounded-2xl border border-[#D2D2D7] shadow-sm p-5">
              <h2 className="text-sm font-semibold text-[#1D1D1F] mb-2">Summary</h2>
              <p className="text-xs text-[#6E6E73] leading-relaxed">{mem.long_term_summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-[#86868B] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export default function TeacherPage() {
  return (
    <React.Suspense
      fallback={
        <div className="container py-12 text-sm text-[#86868B]">Loading…</div>
      }
    >
      <TeacherPageInner />
    </React.Suspense>
  );
}
