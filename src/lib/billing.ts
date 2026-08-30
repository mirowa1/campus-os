import type { SupabaseClient } from "@supabase/supabase-js";

export type StripeSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export type SubscriptionStatus = "free" | StripeSubscriptionStatus;

/** Premium access: trialing, active, and past_due (Stripe retry window). */
export const PREMIUM_STATUSES = new Set<SubscriptionStatus>([
  "trialing",
  "active",
  "past_due",
]);

export const FREE_CLASSTOEXCEL_LIMIT = 3;

export type BillingProfile = {
  id: string;
  free_syllabus_used: boolean;
  free_calendar_sync_used: boolean;
  classtoexcel_conversions_used: number;
  subscription_status: SubscriptionStatus;
  subscription_plan: BillingPlan | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
  subscription_expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type BillingPlan = "monthly" | "6month" | "annual";

export const PLANS: Record<
  BillingPlan,
  { label: string; priceEnvKey: string; hasTrial: boolean }
> = {
  monthly: {
    label: "$5.99/month — 3-day free trial",
    priceEnvKey: "STRIPE_PRICE_MONTHLY",
    hasTrial: true,
  },
  "6month": {
    label: "$50 every 6 months — 3-day free trial",
    priceEnvKey: "STRIPE_PRICE_6MONTH",
    hasTrial: true,
  },
  annual: {
    label: "$70/year",
    priceEnvKey: "STRIPE_PRICE_ANNUAL",
    hasTrial: false,
  },
};

export function isBillingPlan(value: string): value is BillingPlan {
  return value === "monthly" || value === "6month" || value === "annual";
}

export function getStripePriceId(plan: BillingPlan): string {
  const envKey = PLANS[plan].priceEnvKey;
  const id = process.env[envKey]?.trim();
  if (!id) {
    throw new Error(`${envKey} is not set`);
  }
  return id;
}

export class PaywallError extends Error {
  feature: "syllabus" | "calendar_sync" | "classtoexcel";
  constructor(feature: "syllabus" | "calendar_sync" | "classtoexcel") {
    super("PAYWALL_REQUIRED");
    this.name = "PaywallError";
    this.feature = feature;
  }
}

const BILLING_PROFILE_COLUMNS =
  "id, free_syllabus_used, free_calendar_sync_used, classtoexcel_conversions_used, subscription_status, subscription_plan, subscription_current_period_end, subscription_cancel_at_period_end, subscription_expires_at, stripe_customer_id, stripe_subscription_id";

async function ensureBillingRow(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<BillingProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(BILLING_PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return data as BillingProfile;
  }

  const { data: created, error: upsertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: email || `${userId}@unknown.local`,
      },
      { onConflict: "id" }
    )
    .select(BILLING_PROFILE_COLUMNS)
    .single();

  if (upsertError || !created) {
    throw upsertError || new Error("Failed to create billing profile");
  }
  return created as BillingProfile;
}

export function hasActiveSubscription(profile: BillingProfile): boolean {
  // Ignore legacy/manual rows: premium requires a Stripe-mirrored subscription id.
  if (!profile.stripe_subscription_id?.trim()) return false;
  return PREMIUM_STATUSES.has(profile.subscription_status);
}

export function hasBlockingSubscription(profile: BillingProfile): boolean {
  return hasActiveSubscription(profile);
}

export async function getBillingProfile(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<BillingProfile> {
  return ensureBillingRow(supabase, userId, email);
}

export async function assertCanUseSyllabus(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<BillingProfile> {
  const profile = await getBillingProfile(supabase, userId, email);
  if (hasActiveSubscription(profile)) return profile;
  if (!profile.free_syllabus_used) return profile;
  throw new PaywallError("syllabus");
}

export async function assertCanUseCalendarSync(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<BillingProfile> {
  const profile = await getBillingProfile(supabase, userId, email);
  if (hasActiveSubscription(profile)) return profile;
  if (!profile.free_calendar_sync_used) return profile;
  throw new PaywallError("calendar_sync");
}

export async function markFreeSyllabusUsed(
  supabase: SupabaseClient,
  profile: BillingProfile
): Promise<void> {
  if (hasActiveSubscription(profile) || profile.free_syllabus_used) return;
  const { error } = await supabase
    .from("profiles")
    .update({ free_syllabus_used: true })
    .eq("id", profile.id);
  if (error) throw error;
}

export async function markFreeCalendarSyncUsed(
  supabase: SupabaseClient,
  profile: BillingProfile
): Promise<void> {
  if (hasActiveSubscription(profile) || profile.free_calendar_sync_used) return;
  const { error } = await supabase
    .from("profiles")
    .update({ free_calendar_sync_used: true })
    .eq("id", profile.id);
  if (error) throw error;
}

export function getClassToExcelRemaining(profile: BillingProfile): number | null {
  if (hasActiveSubscription(profile)) return null;
  return Math.max(
    0,
    FREE_CLASSTOEXCEL_LIMIT - profile.classtoexcel_conversions_used
  );
}

export async function assertCanUseClassToExcel(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<BillingProfile> {
  const profile = await getBillingProfile(supabase, userId, email);
  if (hasActiveSubscription(profile)) return profile;
  if (profile.classtoexcel_conversions_used < FREE_CLASSTOEXCEL_LIMIT) {
    return profile;
  }
  throw new PaywallError("classtoexcel");
}

export async function incrementClassToExcelUsage(
  supabase: SupabaseClient,
  profile: BillingProfile
): Promise<void> {
  if (hasActiveSubscription(profile)) return;
  if (profile.classtoexcel_conversions_used >= FREE_CLASSTOEXCEL_LIMIT) return;
  const { error } = await supabase
    .from("profiles")
    .update({
      classtoexcel_conversions_used: profile.classtoexcel_conversions_used + 1,
    })
    .eq("id", profile.id);
  if (error) throw error;
}
