-- Personal calendar events (reminders/tasks — not grade-affecting assessments)
-- Run after 003_multi_titled_notes.sql

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  title text not null,
  event_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_user_id_event_date_idx
  on public.calendar_events (user_id, event_date);

alter table public.calendar_events enable row level security;

-- class_id null OR class owned by the same auth user (not merely calendar_events.user_id)
create or replace function public.calendar_event_class_owned(p_class_id uuid)
returns boolean
language sql
stable
as $$
  select p_class_id is null
    or exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.user_id = auth.uid()
    );
$$;

create policy "Users can view own calendar events"
  on public.calendar_events for select
  using (
    auth.uid() = user_id
    and public.calendar_event_class_owned(class_id)
  );

create policy "Users can insert own calendar events"
  on public.calendar_events for insert
  with check (
    auth.uid() = user_id
    and public.calendar_event_class_owned(class_id)
  );

create policy "Users can update own calendar events"
  on public.calendar_events for update
  using (
    auth.uid() = user_id
    and public.calendar_event_class_owned(class_id)
  )
  with check (
    auth.uid() = user_id
    and public.calendar_event_class_owned(class_id)
  );

create policy "Users can delete own calendar events"
  on public.calendar_events for delete
  using (
    auth.uid() = user_id
    and public.calendar_event_class_owned(class_id)
  );
