-- The child is told when a reminder cannot reach the parent: no message from the parent in
-- 24 hours and no approved WhatsApp template.
-- Run before the code that adds this alert goes live.
alter table public.alerts drop constraint if exists alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check
  check (kind in ('new_list','dose_missed','report_out_of_range','advice_question','emergency','course_ended','reminder_not_sent'));
