-- Stripe subscription billing (replaces one-time payment expiry model)
-- Apply in Supabase SQL Editor after 018_billing_freemium.sql
--
-- subscription_status mirrors Stripe Subscription.status values, plus 'free'
-- for users who have never subscribed. subscription_expires_at is deprecated;
-- use subscription_current_period_end (synced from Stripe webhooks) for UI only.

-- New subscription columns
alter table public.profiles
  add column if not exists stripe_subscription_id text;

alter table public.profiles
  add column if not exists subscription_plan text;

alter table public.profiles
  add column if not exists subscription_current_period_end timestamptz;

alter table public.profiles
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

-- One Stripe subscription per profile (when present)
create unique index if not exists profiles_stripe_subscription_id_key
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.profiles
  drop constraint if exists profiles_subscription_plan_check;

alter table public.profiles
  add constraint profiles_subscription_plan_check
  check (subscription_plan is null or subscription_plan in ('monthly', '6month', 'annual'));

-- Expand subscription_status to Stripe-aligned values
alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

-- Map legacy one-time "expired" rows to Stripe "canceled" before adding new check
update public.profiles
set subscription_status = 'canceled'
where subscription_status = 'expired';

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (
    subscription_status in (
      'free',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused'
    )
  );

-- subscription_expires_at: retained for rollback/audit; no longer written by app.
comment on column public.profiles.subscription_expires_at is
  'Deprecated. One-time billing used this for manual expiry. Subscriptions use subscription_current_period_end + subscription_status from Stripe webhooks.';

comment on column public.profiles.subscription_status is
  'free = never subscribed; otherwise mirrors Stripe Subscription.status (trialing, active, past_due, etc.).';

comment on column public.profiles.stripe_subscription_id is
  'Stripe Subscription ID (sub_…). Source of truth for billing lifecycle via webhooks.';

comment on column public.profiles.subscription_plan is
  'Checkout plan key: monthly, 6month, or annual. Set from subscription metadata.';

comment on column public.profiles.subscription_current_period_end is
  'Synced from Stripe Subscription.current_period_end. Display only — gating uses subscription_status.';
