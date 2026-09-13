import { NextResponse } from "next/server";
import {
  canOpenCustomerPortal,
  getBillingProfile,
  isManualComp,
} from "@/lib/billing";
import { getStripe, siteUrl } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getBillingProfile(supabase, user.id, user.email);

    if (isManualComp(profile)) {
      return NextResponse.json(
        {
          error:
            "Complimentary Pro is managed by CoreMax — there is no Stripe billing portal for this account.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    let customerId = profile.stripe_customer_id?.trim() || null;
    const subscriptionId = profile.stripe_subscription_id?.trim() || null;

    // Edge case: paid sub id present but customer id missing — recover from Stripe.
    if (
      (!customerId || !customerId.startsWith("cus_")) &&
      subscriptionId?.startsWith("sub_")
    ) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const recovered =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id || null;
      if (recovered?.startsWith("cus_")) {
        customerId = recovered;
        await supabase
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", user.id);
        profile.stripe_customer_id = customerId;
      }
    }

    if (!canOpenCustomerPortal({ ...profile, stripe_customer_id: customerId })) {
      return NextResponse.json(
        {
          error:
            "No Stripe subscription found. Upgrade to Pro to manage billing.",
        },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId!,
      return_url: `${siteUrl()}/settings`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create billing portal session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Billing portal session failed";
    console.error("billing/portal:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
