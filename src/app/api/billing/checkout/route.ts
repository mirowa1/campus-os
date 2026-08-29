import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  getStripePriceId,
  hasBlockingSubscription,
  isBillingPlan,
  PLANS,
  type BillingPlan,
  type BillingProfile,
  getBillingProfile,
} from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { getStripe, siteUrl } from "@/lib/stripe";

export const runtime = "nodejs";

async function resolveStripeCustomerId(
  stripe: Stripe,
  supabase: SupabaseClient,
  profile: BillingProfile,
  user: { id: string; email?: string | null }
): Promise<string> {
  let customerId = profile.stripe_customer_id?.trim() || null;

  if (customerId) {
    try {
      await stripe.customers.retrieve(customerId);
    } catch (err) {
      const missing =
        err instanceof Stripe.errors.StripeInvalidRequestError &&
        err.code === "resource_missing";
      if (!missing) throw err;
      console.warn(
        "[billing/checkout] stale stripe_customer_id, creating new customer",
        { userId: user.id, staleCustomerId: customerId }
      );
      customerId = null;
    }
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  return customerId;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      plan?: string;
    };
    const planRaw = body.plan;
    if (!planRaw || !isBillingPlan(planRaw)) {
      return NextResponse.json(
        { error: "Invalid plan. Use 'monthly', '6month', or 'annual'." },
        { status: 400 }
      );
    }
    const plan: BillingPlan = planRaw;

    const profile = await getBillingProfile(supabase, user.id, user.email);
    if (hasBlockingSubscription(profile)) {
      return NextResponse.json(
        { error: "You already have an active subscription." },
        { status: 409 }
      );
    }

    const stripe = getStripe();
    const planInfo = PLANS[plan];
    const priceId = getStripePriceId(plan);

    const customerId = await resolveStripeCustomerId(
      stripe,
      supabase,
      profile,
      user
    );

    const base = siteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      wallet_options: {
        link: { display: "never" },
      },
      subscription_data: planInfo.hasTrial
        ? {
            trial_period_days: 3,
            metadata: { userId: user.id, plan },
          }
        : {
            metadata: { userId: user.id, plan },
          },
      metadata: {
        userId: user.id,
        plan,
      },
      success_url: `${base}/settings?billing=success`,
      cancel_url: `${base}/settings?billing=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create Checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Checkout session failed";
    console.error("billing/checkout:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
