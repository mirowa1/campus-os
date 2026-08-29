-- Freemium billing columns on profiles
-- Apply in Supabase SQL Editor after 017_google_calendar.sql

alter table public.profiles
  add column if not exists free_syllabus_used boolean not null default false;

alter table public.profiles
  add column if not exists free_calendar_sync_used boolean not null default false;

alter table public.profiles
  add column if not exists subscription_status text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('free', 'active', 'expired'));

alter table public.profiles
  add column if not exists subscription_expires_at timestamptz;

alter table public.profiles
  add column if not exists stripe_customer_id text;

-- Backfill: users who already have classes have used free syllabus
update public.profiles p
set free_syllabus_used = true
where exists (select 1 from public.classes c where c.user_id = p.id);

-- Backfill: users who already synced to Google have used free calendar sync
update public.profiles p
set free_calendar_sync_used = true
where exists (
  select 1 from public.google_calendar_event_map m where m.user_id = p.id
);
