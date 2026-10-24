-- Signed-in users can change only these fields of their own family. The parent's number,
-- the link date and the link code are set by the server, so nobody can point another
-- person's WhatsApp at their own account.
-- Run only after the code that creates families and changes the number on the server is live.
revoke insert, update on public.families from anon, authenticated;
grant update (child_name, parent_call_name, child_lang, parent_lang, meal_b, meal_l, meal_d)
  on public.families to authenticated;
