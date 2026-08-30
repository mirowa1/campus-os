-- ClassToExcel free-tier usage counter on profiles

alter table public.profiles
  add column if not exists classtoexcel_conversions_used integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_classtoexcel_conversions_used_check;

alter table public.profiles
  add constraint profiles_classtoexcel_conversions_used_check
  check (classtoexcel_conversions_used >= 0);
