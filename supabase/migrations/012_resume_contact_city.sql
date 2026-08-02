-- Contact city for "City, ST" display on resume header
alter table public.resume_data
  add column if not exists city text;
