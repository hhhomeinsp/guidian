"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "guidian.consent";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) acceptRef.current?.focus();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") decline();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function accept() {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ status: "accepted", at: new Date().toISOString() }),
    );
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#D2D2D7] bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-6"
    >
      <div className="container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-sm text-mist">
          We use cookies to track your learning progress and issue compliance
          certificates. Required for CE credit reporting.{" "}
          <Link
            href="/privacy"
            className="underline text-[#0071E3] hover:text-[#0077ED]"
          >
            Privacy Policy
          </Link>
          {" · "}
          <button
            onClick={decline}
            className="underline text-[#0071E3] hover:text-[#0077ED] font-body text-sm"
          >
            Cookie Settings
          </button>
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="rounded-md border border-[#D2D2D7] rounded-full px-5 py-2 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
          >
            Decline
          </button>
          <button
            ref={acceptRef}
            onClick={accept}
            className="rounded-full bg-[#0071E3] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0077ED]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
