-- A picture of each medicine, so a parent who can't read the name knows which strip to take.
-- "real": the child's photo of the strip, in the private uploads bucket (photo_path).
-- "sample": a photo found on the web for the name (photo_url), credited to its site (photo_source).
-- Run before the code that shows medicine photos goes live.
alter table public.medicines add column if not exists photo_kind text check (photo_kind in ('real','sample'));
alter table public.medicines add column if not exists photo_path text;
alter table public.medicines add column if not exists photo_url text;
alter table public.medicines add column if not exists photo_source text;
