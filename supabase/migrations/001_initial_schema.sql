-- CampusOS initial schema
-- Run in Supabase SQL Editor

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Classes
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  code text,
  term text,
  target_letter text,
  target_percent numeric(5,2),
  created_at timestamptz not null default now()
);

create index if not exists classes_user_id_idx on public.classes (user_id);

alter table public.classes enable row level security;

create policy "Users can view own classes"
  on public.classes for select
  using (auth.uid() = user_id);

create policy "Users can insert own classes"
  on public.classes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own classes"
  on public.classes for update
  using (auth.uid() = user_id);

create policy "Users can delete own classes"
  on public.classes for delete
  using (auth.uid() = user_id);

-- Assessments
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null,
  type text not null check (type in ('assignment', 'quiz', 'exam', 'other')),
  due_date date,
  weight_percent numeric(5,2) not null default 0,
  score numeric(6,2),
  max_score numeric(6,2) not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists assessments_class_id_idx on public.assessments (class_id);
create index if not exists assessments_due_date_idx on public.assessments (due_date);

alter table public.assessments enable row level security;

create policy "Users can view own assessments"
  on public.assessments for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = assessments.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert own assessments"
  on public.assessments for insert
  with check (
    exists (
      select 1 from public.classes c
      where c.id = assessments.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can update own assessments"
  on public.assessments for update
  using (
    exists (
      select 1 from public.classes c
      where c.id = assessments.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can delete own assessments"
  on public.assessments for delete
  using (
    exists (
      select 1 from public.classes c
      where c.id = assessments.class_id and c.user_id = auth.uid()
    )
  );

-- Storage bucket for syllabi
insert into storage.buckets (id, name, public)
values ('syllabi', 'syllabi', false)
on conflict (id) do nothing;

create policy "Users can upload own syllabi"
  on storage.objects for insert
  with check (
    bucket_id = 'syllabi'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own syllabi"
  on storage.objects for select
  using (
    bucket_id = 'syllabi'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own syllabi"
  on storage.objects for delete
  using (
    bucket_id = 'syllabi'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
