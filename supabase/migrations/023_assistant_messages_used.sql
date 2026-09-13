-- Free-tier AI assistant message counter on profiles (10 free messages total)

alter table public.profiles
  add column if not exists assistant_messages_used integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_assistant_messages_used_check;

alter table public.profiles
  add constraint profiles_assistant_messages_used_check
  check (assistant_messages_used >= 0);
