-- A course with a last day: reminders stop after it, and the medicine is marked stopped.
-- "Only when needed" (SOS) medicines stay on the list but are never reminded.
-- Run before the code that reads these columns goes live.
alter table public.medicines add column if not exists ends_on date;
alter table public.medicines add column if not exists as_needed boolean not null default false;

-- The child is told when a course ends.
alter table public.alerts drop constraint if exists alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check
  check (kind in ('new_list','dose_missed','report_out_of_range','advice_question','emergency','course_ended'));
