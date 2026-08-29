"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BillingBannerInner() {
  const params = useSearchParams();
  const billing = params.get("billing");
  if (billing === "success") {
    return (
      <p className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)]">
        Checkout complete. Premium access unlocks once your payment is
        confirmed — usually within a minute.
      </p>
    );
  }
  if (billing === "cancelled") {
    return (
      <p className="rounded-lg border border-[var(--muted)]/30 bg-[var(--bg-soft)] px-3 py-2 text-sm text-[var(--muted)]">
        Checkout cancelled. You can subscribe anytime from the paywall.
      </p>
    );
  }
  return null;
}

export function BillingBanner() {
  return (
    <Suspense fallback={null}>
      <BillingBannerInner />
    </Suspense>
  );
}
