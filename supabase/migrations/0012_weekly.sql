-- "Once a week" medicines stay on the list but get no daily meal reminder, so a weekly
-- medicine is never reminded every day.
-- Run before the code that reads this column goes live.
alter table public.medicines add column if not exists weekly boolean not null default false;
