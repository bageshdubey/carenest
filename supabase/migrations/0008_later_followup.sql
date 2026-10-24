-- "Later" on a reminder and one follow-up before a dose counts as not marked.
-- reminded_at: when the last reminder went (the first one, or a resend after Later). Empty means sent_at.
-- later_count: how many times the parent tapped Later (at most 2). later_until: when the next reminder goes.
-- followup_at: when the one "just checking" message went.
-- Run before the code that reads these columns goes live.
alter table public.doses add column if not exists reminded_at timestamptz;
alter table public.doses add column if not exists later_count integer not null default 0;
alter table public.doses add column if not exists later_until timestamptz;
alter table public.doses add column if not exists followup_at timestamptz;
