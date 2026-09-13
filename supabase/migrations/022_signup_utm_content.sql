-- Per-creative / per-video first-touch attribution (nullable for organic + older TikTok signups)
alter table public.profiles
  add column if not exists signup_utm_content text;

comment on column public.profiles.signup_utm_content is
  'First-touch utm_content (creative/ad) captured at signup; never overwritten.';
