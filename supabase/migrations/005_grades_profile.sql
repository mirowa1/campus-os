-- Grades trends + profile fields
-- Run after 004_calendar_events.sql

-- Snapshot class average before each score change (for trend arrows)
create table if not exists public.score_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  old_score numeric(6,2),
  new_score numeric(6,2),
  class_average_before numeric(6,2),
  created_at timestamptz not null default now()
);

create index if not exists score_history_class_id_created_at_idx
  on public.score_history (class_id, created_at desc);

create index if not exists score_history_user_id_idx
  on public.score_history (user_id);

alter table public.score_history enable row level security;

create policy "Users can view own score history"
  on public.score_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own score history"
  on public.score_history for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.classes c
      where c.id = score_history.class_id
        and c.user_id = auth.uid()
    )
  );

-- Profile fields (student_id is owner-only via existing profiles RLS)
alter table public.profiles
  add column if not exists full_name text;

alter table public.profiles
  add column if not exists major text;

alter table public.profiles
  add column if not exists expected_grad_term text;

alter table public.profiles
  add column if not exists student_id text;

alter table public.profiles
  add column if not exists avatar_path text;

-- Private avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own avatar"
  on storage.objects for select
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
