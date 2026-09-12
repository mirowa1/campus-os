-- First-touch marketing attribution at signup (nullable for organic users)
alter table public.profiles
  add column if not exists signup_utm_source text,
  add column if not exists signup_utm_medium text,
  add column if not exists signup_utm_campaign text;

create index if not exists profiles_signup_utm_source_idx
  on public.profiles (signup_utm_source)
  where signup_utm_source is not null;

comment on column public.profiles.signup_utm_source is
  'First-touch utm_source captured at signup; never overwritten.';
comment on column public.profiles.signup_utm_medium is
  'First-touch utm_medium captured at signup; never overwritten.';
comment on column public.profiles.signup_utm_campaign is
  'First-touch utm_campaign captured at signup; never overwritten.';
