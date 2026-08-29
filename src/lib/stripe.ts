import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!key.startsWith("sk_test_") && process.env.NODE_ENV !== "production") {
    console.warn(
      "[stripe] STRIPE_SECRET_KEY does not look like a test key (sk_test_…)"
    );
  }
  if (!stripe) {
    stripe = new Stripe(key);
  }
  return stripe;
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}
