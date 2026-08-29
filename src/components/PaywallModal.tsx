"use client";

import { useState } from "react";
import type { BillingPlan } from "@/lib/billing";

type Props = {
  open: boolean;
  feature: "syllabus" | "calendar_sync" | null;
  onClose: () => void;
};

const FEATURE_COPY: Record<"syllabus" | "calendar_sync", string> = {
  syllabus:
    "Your first syllabus upload is free. Subscribe to upload more syllabi and keep syncing your calendar.",
  calendar_sync:
    "Your first Google Calendar sync is free. Subscribe for unlimited syllabus uploads and calendar syncs.",
};

const PLAN_OPTIONS: { plan: BillingPlan; primary?: boolean }[] = [
  { plan: "monthly", primary: true },
  { plan: "6month" },
  { plan: "annual" },
];

export function PaywallModal({ open, feature, onClose }: Props) {
  const [busy, setBusy] = useState<BillingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open || !feature) return null;

  async function startCheckout(plan: BillingPlan) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout");
        setBusy(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not start checkout");
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <div className="surface w-full max-w-md rounded-2xl p-6 shadow-xl">
        <h2 id="paywall-title" className="font-heading text-2xl">
          Unlock Coursework Pro
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {FEATURE_COPY[feature]}
        </p>

        <div className="mt-6 space-y-3">
          {PLAN_OPTIONS.map(({ plan, primary }) => (
            <button
              key={plan}
              type="button"
              className={`btn w-full text-sm ${primary ? "btn-primary" : "btn-ghost"}`}
              disabled={!!busy}
              onClick={() => void startCheckout(plan)}
            >
              {busy === plan
                ? "Redirecting…"
                : plan === "monthly"
                  ? "$5.99/month — 3-day free trial"
                  : plan === "6month"
                    ? "$50 every 6 months — 3-day free trial"
                    : "$70/year"}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-[var(--muted)]">
          Monthly and 6-month plans include a 3-day free trial. Card required
          upfront. Cancel anytime.
        </p>

        {error && (
          <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
        )}

        <button
          type="button"
          className="btn btn-ghost mt-4 w-full text-sm"
          disabled={!!busy}
          onClick={onClose}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
