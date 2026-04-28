"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearTokens } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [fontSize, setFontSize] = useState<string>(() => {
    if (typeof window === "undefined") return "normal";
    return localStorage.getItem("guidian.fontSize") ?? "normal";
  });
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("guidian.highContrast") === "true";
  });
  const cancelRef = useRef<HTMLButtonElement>(null);

  function applyFontSize(size: string) {
    setFontSize(size);
    localStorage.setItem("guidian.fontSize", size);
    document.body.classList.remove("font-size-large", "font-size-xl");
    if (size === "large") document.body.classList.add("font-size-large");
    if (size === "xl") document.body.classList.add("font-size-xl");
  }

  function applyHighContrast(enabled: boolean) {
    setHighContrast(enabled);
    localStorage.setItem("guidian.highContrast", String(enabled));
    document.body.classList.toggle("high-contrast", enabled);
  }

  async function downloadData() {
    const data = await apiFetch<unknown>("/users/me/data-export");
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "guidian-my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await apiFetch("/users/me/account", { method: "DELETE" });
      clearTokens();
      router.push("/login");
    } catch {
      setDeleteError("Failed to delete account. Please try again or contact support.");
      setDeleteLoading(false);
    }
  }

  return (
    <main className="container max-w-2xl py-10 space-y-10">
      <div className="pb-4 border-b-2 border-amber">
        <h1 className="font-display text-3xl font-bold text-navy">Settings</h1>
      </div>

      {/* Your Data */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-navy">Your Data</h2>
        <div className="rounded-xl border border-cloud bg-white shadow-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-body text-sm font-semibold text-navy">Download my data</p>
              <p className="font-body text-xs text-steel mt-0.5">
                Export all your learning progress, certificates, and account data as JSON.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadData}>
              Download
            </Button>
          </div>
          <hr className="border-cloud" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-body text-sm font-semibold text-error">Delete my account</p>
              <p className="font-body text-xs text-steel mt-0.5">
                Permanently anonymize your account. This cannot be undone.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-error/50 text-error hover:bg-error-bg"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        </div>
      </section>

      {/* Notifications (placeholder) */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-navy">Notifications</h2>
        <div className="rounded-xl border border-cloud bg-white shadow-card p-5">
          <p className="font-body text-sm text-steel">
            Push notification preferences will be available in a future update.
          </p>
        </div>
      </section>

      {/* Accessibility */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-navy">Accessibility</h2>
        <div className="rounded-xl border border-cloud bg-white shadow-card p-5 space-y-5">
          <div>
            <p className="font-body text-sm font-semibold text-navy mb-2">Font size</p>
            <div className="flex gap-2 flex-wrap">
              {(["normal", "large", "xl"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => applyFontSize(size)}
                  className={`rounded-md border px-4 py-2 font-body text-sm transition-colors ${
                    fontSize === size
                      ? "border-navy bg-navy text-white"
                      : "border-cloud bg-fog text-ink hover:border-navy/40"
                  }`}
                >
                  {size === "normal" ? "Normal" : size === "large" ? "Large" : "Extra Large"}
                </button>
              ))}
            </div>
          </div>
          <hr className="border-cloud" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-sm font-semibold text-navy">High contrast mode</p>
              <p className="font-body text-xs text-steel mt-0.5">
                Increases contrast ratios for improved readability.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={highContrast}
              onClick={() => applyHighContrast(!highContrast)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-navy ${
                highContrast ? "bg-navy" : "bg-cloud"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  highContrast ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Delete confirmation modal */}
      {deleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-card-hover space-y-4">
            <h3
              id="delete-modal-title"
              className="font-display text-lg font-bold text-navy"
            >
              Delete account?
            </h3>
            <p className="font-body text-sm text-steel">
              This will anonymize your email, clear your profile, and deactivate
              your account. Compliance audit records are retained for regulatory
              purposes. This action cannot be undone.
            </p>
            {deleteError && (
              <p role="alert" className="font-body text-xs text-error">
                {deleteError}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <Button
                ref={cancelRef}
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                className="bg-error text-white hover:bg-error/90"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting…" : "Yes, delete my account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
