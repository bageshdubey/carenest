-- A stopped medicine stays in the family's history with the time it was stopped, instead of being deleted.
-- Ongoing medicines are still the ones with active = true. Safe to run before the code: nothing reads this yet.
alter table public.medicines add column if not exists stopped_at timestamptz;
