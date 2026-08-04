-- SMS notification preferences (A2P consent + phone verify)
-- User manages only their own row via RLS.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sms_enabled boolean not null default false,
  phone_number text,
  phone_verified boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "Users can view own notification prefs"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own notification prefs"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification prefs"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own notification prefs"
  on public.notification_preferences for delete
  using (auth.uid() = user_id);
