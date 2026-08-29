import type Stripe from "stripe";
import type { BillingPlan } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";

function planFromMetadata(value: string | undefined): BillingPlan | null {
  if (value === "monthly" || value === "6month" || value === "annual") {
    return value;
  }
  return null;
}

function periodEndIso(subscription: Stripe.Subscription): string | null {
  const end = subscription.items?.data?.[0]?.current_period_end;
  if (!end) return null;
  return new Date(end * 1000).toISOString();
}

/** Mirror Stripe Subscription fields onto profiles (service role). */
export async function syncProfileFromStripeSubscription(
  subscription: Stripe.Subscription,
  opts?: { userId?: string | null }
): Promise<void> {
  const admin = createAdminClient();

  let profileId = opts?.userId || subscription.metadata?.userId || null;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || null;

  if (!profileId && customerId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    profileId = data?.id ?? null;
  }

  if (!profileId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();
    profileId = data?.id ?? null;
  }

  if (!profileId) {
    console.error("[stripe-sync] no profile for subscription", subscription.id);
    return;
  }

  const plan = planFromMetadata(subscription.metadata?.plan);
  const update: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_current_period_end: periodEndIso(subscription),
    subscription_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
  };
  if (customerId) update.stripe_customer_id = customerId;
  if (plan) update.subscription_plan = plan;

  const { error } = await admin.from("profiles").update(update).eq("id", profileId);
  if (error) throw error;
}
