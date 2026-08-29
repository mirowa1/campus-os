import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { isBillingPlan } from "@/lib/billing";
import { syncProfileFromStripeSubscription } from "@/lib/stripe-subscription-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

async function subscriptionIdFromInvoice(
  invoice: Stripe.Invoice
): Promise<string | null> {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId =
    session.metadata?.userId || session.client_reference_id || null;
  const plan = session.metadata?.plan;
  if (!userId || !plan || !isBillingPlan(plan)) {
    console.error("billing/webhook: checkout missing userId or plan", {
      userId,
      plan,
    });
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || null;

  const admin = createAdminClient();
  if (customerId) {
    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;

  if (!subId) {
    console.error("billing/webhook: checkout session has no subscription", {
      sessionId: session.id,
    });
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subId);
  await syncProfileFromStripeSubscription(subscription, { userId });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("billing/webhook: STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid webhook signature";
    console.error("billing/webhook signature:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncProfileFromStripeSubscription(subscription);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = await subscriptionIdFromInvoice(invoice);
        if (!subId) break;
        const subscription = await stripe.subscriptions.retrieve(subId);
        await syncProfileFromStripeSubscription(subscription);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("billing/webhook:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
