"use client";

import { useState } from "react";
import {
  canOpenCustomerPortal,
  isManualComp,
  PLANS,
  type BillingProfile,
  type SubscriptionStatus,
} from "@/lib/billing";
import { PaywallModal } from "@/components/PaywallModal";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  free: "Free",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Incomplete (expired)",
  paused: "Paused",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BillingSettingsCard({ profile }: { profile: BillingProfile }) {
  const [portalBusy, setPortalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const comp = isManualComp(profile);
  const canPortal = canOpenCustomerPortal(profile);
  const statusLabel =
    STATUS_LABELS[profile.subscription_status] ?? profile.subscription_status;
  const planLabel = profile.subscription_plan
    ? PLANS[profile.subscription_plan].label
    : null;
  const periodEnd = formatDate(profile.subscription_current_period_end);
  const expiresAt = formatDate(profile.subscription_expires_at);

  async function openPortal() {
    setPortalBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Could not open billing portal");
        setPortalBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not open billing portal");
      setPortalBusy(false);
    }
  }

  return (
    <section className="surface space-y-4 rounded-2xl p-6">
      <div>
        <h2 className="font-heading text-xl">Billing &amp; Subscription</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your plan status and billing options.
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
            Status
          </dt>
          <dd className="mt-0.5 font-medium text-[var(--ink)]">{statusLabel}</dd>
        </div>
        {planLabel && !comp && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Plan
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--ink)]">{planLabel}</dd>
          </div>
        )}
        {comp && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Access
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--ink)]">
              Complimentary Pro
            </dd>
          </div>
        )}
        {periodEnd && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
              {profile.subscription_cancel_at_period_end
                ? "Access ends"
                : comp
                  ? "Expires"
                  : "Current period ends"}
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--ink)]">{periodEnd}</dd>
          </div>
        )}
        {!periodEnd && expiresAt && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Expires
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--ink)]">{expiresAt}</dd>
          </div>
        )}
      </dl>

      {profile.subscription_cancel_at_period_end && !comp && (
        <p className="text-sm text-[var(--warn)]">
          Cancellation scheduled — Pro remains until the period end date above.
        </p>
      )}

      {comp && (
        <p className="text-sm text-[var(--muted)]">
          This is a complimentary grant from CoreMax. It is not billed through
          Stripe, so there is no self-serve cancel or payment page.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        {canPortal && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={portalBusy}
            onClick={() => void openPortal()}
          >
            {portalBusy ? "Opening…" : "Manage subscription"}
          </button>
        )}
        {!canPortal && !comp && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setUpgradeOpen(true)}
          >
            Upgrade to Pro
          </button>
        )}
      </div>

      <PaywallModal
        open={upgradeOpen}
        feature="settings"
        onClose={() => setUpgradeOpen(false)}
      />
    </section>
  );
}
