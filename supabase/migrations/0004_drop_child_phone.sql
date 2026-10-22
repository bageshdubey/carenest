-- The child no longer gives a WhatsApp number: alerts show on the dashboard only,
-- because the test number reaches just 5 recipients and those go to parents.
-- Run this only after the code that stopped using child_phone is live, or setup and Settings on the old code will fail.
alter table public.families drop column if exists child_phone;
