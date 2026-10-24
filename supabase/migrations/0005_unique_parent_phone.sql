-- One parent number belongs to one child's account. A second account with the same number is refused.
-- Run after the code that shows the "number already used" message is live.
create unique index if not exists families_parent_phone_key on public.families(parent_phone);
