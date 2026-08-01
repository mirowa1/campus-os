-- Store original syllabus file path on classes for download

alter table public.classes
  add column if not exists syllabus_path text;

alter table public.classes
  add column if not exists syllabus_file_name text;
