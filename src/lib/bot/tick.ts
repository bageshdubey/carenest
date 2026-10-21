import "server-only";
import { activeMedicines, linkedFamilies, markMissed, mealsSentToday, openDoses, recordReminder } from "@/lib/db/repo";
import { mealTimes } from "@/lib/db/rows";
import { dueReminders, isOverdue, istNow, medicinesFor } from "@/lib/domain/meals";
import { mealName, pm, reminderLines } from "@/lib/i18n/parent";
import { alertChild, reminderToParent } from "./send";

/**
 * Runs every few minutes (called by Supabase pg_cron):
 * 1. sends meal reminders that are due,
 * 2. marks reminders with no "Taken" after 60 minutes as not marked and alerts the child.
 */
export async function tick(now: Date = new Date()) {
  const { date } = istNow(now);
  const families = await linkedFamilies();
  const byId = new Map(families.map((f) => [f.id, f]));
  let sent = 0;
  let missed = 0;

  for (const family of families) {
    const meds = await activeMedicines(family.id);
    if (!meds.length) continue;
    const due = dueReminders(mealTimes(family), meds, await mealsSentToday(family.id, date), now);
    for (const meal of due) {
      const lang = family.parent_lang;
      const body = pm(lang, "reminder", {
        meal: mealName(lang, meal),
        n: family.parent_call_name,
        c: family.child_name,
        lines: reminderLines(lang, meal, meds),
      });
      const oneLine = medicinesFor(meal, meds)
        .map((m) => `${m.name} ${m.strength}`)
        .join(", ");
      try {
        await reminderToParent(
          family,
          body,
          [
            { id: `taken:${date}:${meal}`, title: pm(lang, "q_taken") },
            { id: "list", title: pm(lang, "q_list") },
          ],
          [family.parent_call_name, mealName(lang, meal), oneLine],
        );
        await recordReminder(family.id, date, meal);
        sent++;
      } catch (e) {
        console.error(`Reminder failed for family ${family.id} meal ${meal}`, e);
      }
    }
  }

  for (const dose of await openDoses()) {
    if (!isOverdue(new Date(dose.sent_at), now)) continue;
    await markMissed(dose.id);
    const family = byId.get(dose.family_id);
    if (family) await alertChild(family, "dose_missed", { meal: dose.meal });
    missed++;
  }

  return { sent, missed };
}
