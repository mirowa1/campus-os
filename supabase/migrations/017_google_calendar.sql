-- Google Calendar OAuth connections + event id map (testing mode)

create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_connections enable row level security;

create policy "Users manage own google_calendar_connections"
  on public.google_calendar_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.google_calendar_event_map (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  assessment_id uuid references public.assessments (id) on delete cascade,
  class_meeting_id uuid references public.class_meetings (id) on delete cascade,
  google_event_id text not null,
  synced_at timestamptz not null default now(),
  constraint google_calendar_event_map_one_source check (
    (assessment_id is not null and class_meeting_id is null)
    or (assessment_id is null and class_meeting_id is not null)
  )
);

create unique index if not exists google_calendar_event_map_assessment_uidx
  on public.google_calendar_event_map (user_id, assessment_id)
  where assessment_id is not null;

create unique index if not exists google_calendar_event_map_meeting_uidx
  on public.google_calendar_event_map (user_id, class_meeting_id)
  where class_meeting_id is not null;

create index if not exists google_calendar_event_map_user_id_idx
  on public.google_calendar_event_map (user_id);

alter table public.google_calendar_event_map enable row level security;

create policy "Users manage own google_calendar_event_map"
  on public.google_calendar_event_map for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
