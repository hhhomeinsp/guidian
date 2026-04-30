"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Clock, MapPin, Search } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api/client";
import {
  HOME_INSPECTOR_STATES,
  getStateByCode,
  type StateInfo,
} from "@/lib/data/home-inspector-states";

interface Props {
  courseSlug?: string;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

export function StateEligibilityChecker({
  courseSlug = "certified-home-inspector-100hr",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const selected: StateInfo | null = selectedCode
    ? getStateByCode(selectedCode) ?? null
    : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HOME_INSPECTOR_STATES;
    return HOME_INSPECTOR_STATES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [query]);

  function handleSelect(state: StateInfo) {
    setSelectedCode(state.code);
    setQuery(state.name);
    setOpen(false);
    setSubmitState("idle");
    setSubmitMessage(null);
  }

  async function handleWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !email.trim()) return;
    setSubmitState("submitting");
    setSubmitMessage(null);
    try {
      await apiFetch<{ message: string }>("/waitlist", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          state: selected.code,
          course_slug: courseSlug,
        }),
      });
      setSubmitState("success");
      setSubmitMessage("Thanks — you're on the list. We'll email you when " + selected.name + " is approved.");
      setEmail("");
    } catch (err) {
      setSubmitState("error");
      const msg =
        err instanceof ApiError && err.status === 409
          ? "You're already on the waitlist for this state."
          : "Could not add you to the waitlist. Please try again.";
      setSubmitMessage(msg);
    }
  }

  return (
    <div className="rounded-2xl border border-[#D2D2D7] bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="h-5 w-5 text-[#0071E3]" aria-hidden />
        <h3 className="text-lg font-semibold text-[#1D1D1F]">
          Check your state eligibility
        </h3>
      </div>
      <p className="text-sm text-[#6E6E73] mb-4">
        Home inspector licensing varies by state. Find out if you can enroll
        today.
      </p>

      {/* Searchable state input */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E6E73]"
          aria-hidden
        />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (selectedCode) setSelectedCode(null);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search your state…"
          aria-label="Search for your state"
          className="w-full bg-white border border-[#D2D2D7] rounded-xl pl-10 pr-4 py-3 text-[#1D1D1F] placeholder:text-[#6E6E73] focus:outline-none focus:border-[#0071E3]"
        />
        {open && filtered.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[#D2D2D7] bg-white shadow-lg"
          >
            {filtered.map((s) => (
              <li key={s.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedCode === s.code}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(s);
                  }}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-[#1D1D1F] hover:bg-[#F5F5F7]"
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-[#6E6E73]">{s.code}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && filtered.length === 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#D2D2D7] bg-white px-4 py-3 text-sm text-[#6E6E73] shadow-lg">
            No matching state.
          </div>
        )}
      </div>

      {/* Status card */}
      {selected && (
        <div className="mt-5">
          {selected.status === "no_license" ? (
            <div
              className="rounded-2xl border p-5"
              style={{
                backgroundColor: "#F0FAF1",
                borderColor: "#34C759",
              }}
            >
              <div className="flex items-start gap-3">
                <CheckCircle
                  className="h-5 w-5 shrink-0 text-[#0E7C2D] mt-0.5"
                  aria-hidden
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0E7C2D]">
                    Great news! {selected.name} has no licensing requirement.
                  </p>
                  <p className="mt-1 text-sm text-[#1D1D1F]">
                    {selected.notes}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl border p-5"
              style={{
                backgroundColor: "#FFF8E6",
                borderColor: "#FFB020",
              }}
            >
              <div className="flex items-start gap-3">
                <Clock
                  className="h-5 w-5 shrink-0 text-[#8A5A00] mt-0.5"
                  aria-hidden
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#8A5A00]">
                    {selected.name} requires a state license.
                  </p>
                  <p className="mt-1 text-sm text-[#1D1D1F]">
                    {selected.notes}
                  </p>
                </div>
              </div>

              {selected.waitlist && submitState !== "success" && (
                <form
                  onSubmit={handleWaitlistSubmit}
                  className="mt-4 flex flex-col sm:flex-row gap-2"
                >
                  <label htmlFor="waitlist-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 bg-white border border-[#D2D2D7] rounded-full px-4 py-2.5 text-sm text-[#1D1D1F] placeholder:text-[#6E6E73] focus:outline-none focus:border-[#0071E3]"
                  />
                  <button
                    type="submit"
                    disabled={submitState === "submitting"}
                    className="inline-flex items-center justify-center rounded-full bg-[#0071E3] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0077ED] disabled:opacity-60"
                  >
                    {submitState === "submitting"
                      ? "Joining…"
                      : "Join Waitlist"}
                  </button>
                </form>
              )}

              {submitMessage && (
                <p
                  className={
                    submitState === "success"
                      ? "mt-3 text-sm text-[#0E7C2D]"
                      : "mt-3 text-sm text-[#B3261E]"
                  }
                  role="status"
                >
                  {submitMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
