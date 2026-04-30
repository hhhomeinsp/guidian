"use client";

import * as React from "react";
import { useNovaContext } from "./NovaProvider";
import { apiFetch, getAccessToken } from "@/lib/api/client";
import { API_BASE } from "@/lib/api/sse";

type NovaState = "idle" | "connecting" | "listening" | "speaking" | "error";

interface SubscriptionStatus {
  plan: string;
  status: string;
  nova_enabled?: boolean;
  current_period_end?: string | null;
}

interface TranscriptEntry {
  id: string;
  role: "user" | "nova";
  text: string;
  partial?: boolean;
}

// ── Icon: animated waveform ────────────────────────────────────────────────────

function WaveformIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {[3, 7, 11, 15, 19].map((x, i) => {
        const heights = active ? [8, 14, 18, 14, 8] : [6, 10, 14, 10, 6];
        const h = heights[i];
        const y = (24 - h) / 2;
        return (
          <rect
            key={x}
            x={x}
            y={y}
            width="2"
            height={h}
            rx="1"
            fill="currentColor"
            style={active ? { animation: `novaBar${i} 0.8s ease-in-out infinite`, animationDelay: `${i * 0.1}s` } : undefined}
          />
        );
      })}
    </svg>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ── Mic icon ──────────────────────────────────────────────────────────────────

function MicIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

// ── State label ────────────────────────────────────────────────────────────────

function stateLabel(s: NovaState): string {
  switch (s) {
    case "connecting": return "Connecting…";
    case "listening": return "Nova is listening…";
    case "speaking": return "Nova is speaking…";
    case "error": return "Error";
    default: return "Nova";
  }
}

function stateColor(s: NovaState): string {
  switch (s) {
    case "listening": return "#C98A2A";  // amber — listening
    case "speaking": return "#0E7C7B";  // teal — speaking
    case "error": return "#FF3B30";
    default: return "#162D4A";
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NovaVoice() {
  const { courseId, lessonTitle, setActivateNova } = useNovaContext();

  const [state, setState] = React.useState<NovaState>("idle");
  const [open, setOpen] = React.useState(false);
  const [transcript, setTranscript] = React.useState<TranscriptEntry[]>([]);
  const [errorMsg, setErrorMsg] = React.useState("");
  const mutedRef = React.useRef(false);
  const [mutedDisplay, setMutedDisplay] = React.useState(false);
  const [showProUpsell, setShowProUpsell] = React.useState(false);
  const [upgrading, setUpgrading] = React.useState(false);
  const [upgradeError, setUpgradeError] = React.useState("");

  const wsRef = React.useRef<WebSocket | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const processorRef = React.useRef<ScriptProcessorNode | null>(null);
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const playbackQueueRef = React.useRef<Float32Array[]>([]);
  const isPlayingRef = React.useRef(false);
  const transcriptEndRef = React.useRef<HTMLDivElement>(null);
  const courseIdRef = React.useRef(courseId);
  const lessonTitleRef = React.useRef(lessonTitle);

  // Keep refs in sync so the WS closure always reads latest context
  React.useEffect(() => { courseIdRef.current = courseId; }, [courseId]);
  React.useEffect(() => { lessonTitleRef.current = lessonTitle; }, [lessonTitle]);

  React.useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const stopSession = React.useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setState("idle");
    setOpen(false);
    setTranscript([]);
  }, []);

  const playPcm16 = React.useCallback((base64: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;

    playbackQueueRef.current.push(float32);

    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      const playNext = () => {
        const chunk = playbackQueueRef.current.shift();
        if (!chunk || !audioCtxRef.current) {
          isPlayingRef.current = false;
          if (audioCtxRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
            setState("listening");
          }
          return;
        }
        const buf = audioCtxRef.current.createBuffer(1, chunk.length, 24000);
        buf.getChannelData(0).set(chunk);
        const src = audioCtxRef.current.createBufferSource();
        src.buffer = buf;
        src.connect(audioCtxRef.current.destination);
        src.onended = playNext;
        src.start();
      };
      playNext();
    }
  }, []);

  const startSession = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setErrorMsg("Please log in to use Nova");
      setState("error");
      setOpen(true);
      return;
    }

    setState("connecting");
    setOpen(true);
    setTranscript([]);
    setErrorMsg("");

    const voice =
      typeof window !== "undefined"
        ? (localStorage.getItem("nova.voice") ?? "shimmer")
        : "shimmer";

    try {
      const res = await fetch(`${API_BASE}/nova/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          course_id: courseIdRef.current,
          course_title: lessonTitleRef.current,
          voice,
        }),
      });
      if (!res.ok) throw new Error(`Session error ${res.status}`);
      const { ws_url } = await res.json() as { ws_url: string };

      // Build absolute WS URL from the API base
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
      const wsBase = apiBase.replace(/^https?/, (m) => m === "https" ? "wss" : "ws").replace(/\/api\/v1$/, "");
      const fullWsUrl = ws_url.startsWith("ws") ? ws_url : `${wsBase}${ws_url}`;

      const ws = new WebSocket(fullWsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 24000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          streamRef.current = stream;

          const ctx = new AudioContext({ sampleRate: 24000 });
          audioCtxRef.current = ctx;

          const micSource = ctx.createMediaStreamSource(stream);
          sourceRef.current = micSource;

          // ScriptProcessorNode needs to be in the graph to fire; use silent gain to avoid feedback
          const silentGain = ctx.createGain();
          silentGain.gain.value = 0;

          const processor = ctx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (mutedRef.current || isPlayingRef.current || ws.readyState !== WebSocket.OPEN) return;
            const float32 = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
              const s = Math.max(-1, Math.min(1, float32[i]));
              int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            const bytes = new Uint8Array(int16.buffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            ws.send(JSON.stringify({ type: "audio_chunk", audio: btoa(binary) }));
          };

          micSource.connect(processor);
          processor.connect(silentGain);
          silentGain.connect(ctx.destination);

          setState("listening");
        } catch {
          setErrorMsg("Microphone access denied. Please allow microphone in browser settings.");
          setState("error");
          ws.close();
        }
      };

      ws.onmessage = (ev) => {
        const event = JSON.parse(ev.data as string) as Record<string, string>;
        const t = event.type;

        if (t === "audio_chunk") {
          setState("speaking");
          playPcm16(event.audio);
        } else if (t === "audio_done") {
          // playNext() drains the queue and transitions state when playback finishes
        } else if (t === "transcript_delta") {
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "nova" && last.partial) {
              return [
                ...prev.slice(0, -1),
                { ...last, text: last.text + event.text, partial: true },
              ];
            }
            return [...prev, { id: `s-${Date.now()}`, role: "nova", text: event.text, partial: true }];
          });
        } else if (t === "transcript_done") {
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "nova" && last.partial) {
              return [...prev.slice(0, -1), { ...last, text: event.text, partial: false }];
            }
            return [...prev, { id: `s-${Date.now()}`, role: "nova", text: event.text, partial: false }];
          });
        } else if (t === "user_transcript") {
          setTranscript((prev) => [
            ...prev,
            { id: `u-${Date.now()}`, role: "user", text: event.text },
          ]);
        } else if (t === "speech_started") {
          setState("listening");
        } else if (t === "error") {
          setErrorMsg(event.message ?? "An error occurred");
          setState("error");
        }
      };

      ws.onerror = () => {
        setErrorMsg("Connection error. Please try again.");
        setState("error");
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          setState("idle");
          setOpen(false);
        }
      };
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to start Nova");
      setState("error");
    }
  }, [playPcm16]);

  const requestStart = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      // Allow startSession to handle the no-token error UX
      void startSession();
      return;
    }
    try {
      const sub = await apiFetch<SubscriptionStatus>("/billing/subscription");
      const novaAllowed =
        sub.nova_enabled === true ||
        (sub.plan === "pro" && sub.status === "active");
      if (!novaAllowed) {
        setUpgradeError("");
        setShowProUpsell(true);
        return;
      }
    } catch {
      // If the subscription lookup fails, fall through and let the session
      // attempt surface the error rather than blocking the user entirely.
    }
    void startSession();
  }, [startSession]);

  const handleUpgrade = React.useCallback(async () => {
    setUpgradeError("");
    setUpgrading(true);
    try {
      const res = await apiFetch<{ checkout_url: string | null }>(
        "/billing/checkout",
        {
          method: "POST",
          body: JSON.stringify({ plan: "pro" }),
        },
      );
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      setUpgradeError("Could not start checkout. Try again.");
    } catch {
      setUpgradeError("Could not start checkout. Try again.");
    } finally {
      setUpgrading(false);
    }
  }, []);

  // Expose requestStart so other components can trigger it (with the gate)
  React.useEffect(() => {
    setActivateNova(() => requestStart);
    return () => setActivateNova(null);
  }, [requestStart, setActivateNova]);

  const handleInterrupt = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "interrupt" }));
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setState("listening");
  };

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMutedDisplay(mutedRef.current);
  };

  const active = state !== "idle" && state !== "error";
  const buttonGlow =
    state === "listening"
      ? "shadow-[0_0_20px_rgba(0,113,227,0.6)]"
      : state === "speaking"
      ? "shadow-[0_0_20px_rgba(14,124,123,0.6)]"
      : state === "error"
      ? "shadow-[0_0_16px_rgba(255,59,48,0.5)]"
      : "shadow-[0_4px_20px_rgba(22,45,74,0.35)]";

  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes novaBreath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes novaBar0 { 0%,100%{height:6px;y:9px} 50%{height:14px;y:5px} }
        @keyframes novaBar1 { 0%,100%{height:10px;y:7px} 50%{height:18px;y:3px} }
        @keyframes novaBar2 { 0%,100%{height:14px;y:5px} 50%{height:22px;y:1px} }
        @keyframes novaBar3 { 0%,100%{height:10px;y:7px} 50%{height:18px;y:3px} }
        @keyframes novaBar4 { 0%,100%{height:6px;y:9px} 50%{height:14px;y:5px} }
      `}</style>

      {/* Voice panel — shows above button when open */}
      {open && (
        <div
          className="fixed z-[998] w-80 rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
          style={{
            bottom: "96px",
            right: "24px",
            background: "linear-gradient(160deg, #162D4A 0%, #1E3D5C 60%, #095857 100%)",
          }}
          role="dialog"
          aria-label="Nova voice assistant"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  background: stateColor(state),
                  boxShadow: `0 0 6px ${stateColor(state)}`,
                }}
              />
              <span className="text-white text-sm font-semibold" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
                Nova
              </span>
              <span className="text-white/50 text-xs">{stateLabel(state)}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMute}
                aria-label={mutedDisplay ? "Unmute microphone" : "Mute microphone"}
                className={`p-1.5 rounded-full transition-colors ${mutedDisplay ? "bg-red-500/30 text-red-400" : "text-white/60 hover:text-white hover:bg-white/10"}`}
              >
                <MicIcon muted={mutedDisplay} />
              </button>
              <button
                onClick={stopSession}
                aria-label="End Nova session"
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Transcript */}
          <div className="h-56 overflow-y-auto px-4 py-3 space-y-2 text-sm" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            {transcript.length === 0 && state === "connecting" && (
              <p className="text-white/40 text-xs text-center pt-8">Connecting to Nova…</p>
            )}
            {transcript.length === 0 && state === "listening" && (
              <p className="text-white/40 text-xs text-center pt-8">Nova is ready — start speaking</p>
            )}
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <span
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    entry.role === "user"
                      ? "bg-white/15 text-white/90"
                      : "text-white/80"
                  } ${entry.partial ? "opacity-70" : ""}`}
                >
                  {entry.text}
                </span>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>

          {/* Tap to interrupt when speaking */}
          {state === "speaking" && (
            <div className="px-4 pb-3">
              <button
                onClick={handleInterrupt}
                className="w-full rounded-xl py-2 text-xs font-medium text-white/70 border border-white/20 hover:bg-white/10 transition-colors"
              >
                Tap to interrupt
              </button>
            </div>
          )}

          {/* Error message */}
          {state === "error" && errorMsg && (
            <div className="px-4 pb-3">
              <p className="text-red-400 text-xs text-center">{errorMsg}</p>
              <button
                onClick={startSession}
                className="mt-2 w-full rounded-xl py-2 text-xs font-medium text-white border border-white/20 hover:bg-white/10 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pro upsell modal — gates Nova behind the Pro subscription */}
      {showProUpsell && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Upgrade to Pro"
          onClick={() => setShowProUpsell(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-[#1D1D1F]">
              Upgrade to Pro
            </h2>
            <p className="mt-1 text-sm text-[#6E6E73]">
              $19/mo to unlock Nova AI Instructor on every course you own.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[#1D1D1F]">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#0071E3]" />
                Live voice tutoring on every course
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#0071E3]" />
                Personalized study plans &amp; memory
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[#0071E3]" />
                Priority support &amp; early access
              </li>
            </ul>
            {upgradeError && (
              <p className="mt-3 text-sm text-[#FF3B30]">{upgradeError}</p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowProUpsell(false)}
                className="flex-1 rounded-full border border-[#D2D2D7] px-4 py-2.5 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={upgrading}
                className="flex-1 rounded-full bg-[#0071E3] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0077ED] disabled:opacity-60"
              >
                {upgrading ? "Starting…" : "Upgrade Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Nova button */}
      <button
        onClick={open ? stopSession : requestStart}
        aria-label={open ? "Close Nova voice assistant" : "Open Nova voice assistant"}
        className={`
          fixed z-[999] flex items-center justify-center rounded-full text-white
          transition-all duration-200 hover:scale-105 active:scale-95
          ${buttonGlow}
        `}
        style={{
          width: 64,
          height: 64,
          bottom: 24,
          right: 24,
          background: open
            ? `linear-gradient(135deg, ${stateColor(state)} 0%, #162D4A 60%, #0D1C2E 100%)`
            : "linear-gradient(135deg, #162D4A 0%, #1E3D5C 50%, #0E7C7B 100%)",
          animation: state === "idle" ? "novaBreath 3s ease-in-out infinite" : undefined,
          // Mobile: lift above bottom nav
        }}
      >
        <span
          className="sm:hidden"
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 64,
            height: 64,
            borderRadius: "50%",
          }}
        />
        {state === "connecting" ? (
          <Spinner />
        ) : (
          <WaveformIcon active={active} />
        )}
      </button>

      {/* Mobile bottom offset override via inline style injection */}
      <style>{`
        @media (max-width: 640px) {
          button[aria-label="Open Nova voice assistant"],
          button[aria-label="Close Nova voice assistant"] {
            bottom: 80px !important;
          }
          div[role="dialog"][aria-label="Nova voice assistant"] {
            bottom: 160px !important;
            right: 12px !important;
            width: calc(100vw - 24px) !important;
          }
        }
      `}</style>
    </>
  );
}
