"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GuidianLogo } from "@/components/ui/GuidianLogo";
import { useMe } from "@/lib/api/hooks";
import { getAccessToken } from "@/lib/api/client";
import { API_BASE, streamSSE } from "@/lib/api/sse";

interface Mesnova {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const me = useMe();

  const [mesnovas, setMesnovas] = React.useState<Mesnova[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDone, setIsDone] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const hasInitialized = React.useRef(false);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mesnovas]);

  const sendMesnovas = React.useCallback(
    async (msgs: Mesnova[]) => {
      const token = getAccessToken();
      if (!token) return;
      setIsLoading(true);
      const assistantId = `a-${Date.now()}`;
      let assistantContent = "";
      setMesnovas((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);
      try {
        const apiMesnovas = msgs.map(({ role, content }) => ({ role, content }));
        for await (const chunk of streamSSE(
          `${API_BASE}/teacher/onboarding`,
          { mesnovas: apiMesnovas },
          token,
        )) {
          if (chunk.text) {
            assistantContent += chunk.text;
            setMesnovas((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m)),
            );
          }
          if (chunk.done && chunk.onboarding_complete) {
            setIsDone(true);
            setTimeout(() => router.push("/courses"), 1500);
          }
        }
      } catch {
        setMesnovas((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, something went wrong. Please try again." }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [router],
  );

  React.useEffect(() => {
    if (hasInitialized.current || me.isLoading || me.error) return;
    hasInitialized.current = true;
    sendMesnovas([]);
  }, [me.isLoading, me.error, sendMesnovas]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || isDone) return;
    const userMsg: Mesnova = { id: `u-${Date.now()}`, role: "user", content: text };
    setInput("");
    const nextMesnovas = [...mesnovas, userMsg];
    setMesnovas(nextMesnovas);
    await sendMesnovas(nextMesnovas);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (me.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <span className="text-sm text-[#86868B]">Loading…</span>
      </div>
    );
  }

  if (me.error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <span className="text-sm text-[#86868B]">Please sign in to continue.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Logo */}
      <div className="flex justify-center pt-8 pb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <GuidianLogo size={28} strokeColor="#162D4A" accentColor="#C98A2A" />
          <span className="text-sm font-semibold text-[#1D1D1F]">Guidian</span>
        </div>
      </div>

      {/* Mesnovas */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {mesnovas.map((msg) => (
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
          {isDone && (
            <div className="flex justify-center pt-2">
              <div className="rounded-full bg-green-50 text-green-700 px-5 py-2 text-sm font-medium">
                All set! Heading to your courses…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[#D2D2D7] bg-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer…"
            disabled={isLoading || isDone}
            className="flex-1 rounded-full border border-[#D2D2D7] bg-[#F5F5F7] px-4 py-2.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] outline-none focus:ring-2 focus:ring-[#0071E3]/30 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isDone}
            className="rounded-full bg-[#0071E3] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0077ED] active:bg-[#006FD6] disabled:opacity-40"
          >
            Send
          </button>
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
