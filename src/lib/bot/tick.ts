import "server-only";
import { activeMedicines, latestReportValues, linkedFamilies, markMissed, markVisitReminded, mealsSentToday, openDoses, recordReminder, stopEndedCourses, visitsOn } from "@/lib/db/repo";
import type { FamilyRow } from "@/lib/db/rows";
import { shiftDate } from "@/lib/domain/adherence";
import { mealTimes } from "@/lib/db/rows";
import { MISSED_AFTER_MIN, dueReminders, isOverdue, istNow, medicinesFor, toMinutes } from "@/lib/domain/meals";
import { doctorQuestions, mealName, pm, reminderLines, visitText } from "@/lib/i18n/parent";
import { alertChild, reminderToParent, toParent } from "./send";

/**
 * Runs every few minutes (called by Supabase pg_cron):
 * 0. stops medicines whose course ended yesterday or earlier, and tells the child,
 * 1. sends meal reminders that are due,
 * 2. marks reminders with no "Taken" after 60 minutes as not marked and alerts the child,
 * 3. sends doctor-visit reminders: the evening before (dinner time) and the morning of the visit (breakfast time).
 */
export async function tick(now: Date = new Date()) {
  const { date } = istNow(now);
  const families = await linkedFamilies();
  const byId = new Map(families.map((f) => [f.id, f]));
  let sent = 0;
  let missed = 0;

  try {
    await courseEndings(date, byId);
  } catch (e) {
    console.error("Could not stop ended courses", e);
  }

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

  for (const family of families) {
    try {
      await visitReminders(family, now);
    } catch (e) {
      console.error(`Visit reminder failed for family ${family.id}`, e);
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

/** One alert per family, naming every medicine whose course just ended. */
async function courseEndings(today: string, byId: Map<string, FamilyRow>) {
  const ended = await stopEndedCourses(today);
  const names = new Map<string, string[]>();
  for (const m of ended) names.set(m.family_id, [...(names.get(m.family_id) ?? []), `${m.name} ${m.strength}`.trim()]);
  for (const [familyId, list] of names) {
    const family = byId.get(familyId);
    if (family) await alertChild(family, "course_ended", { m: list.join(", ") });
  }
}

/** True when "now" is inside the hour after this meal time, the same window meal reminders use. */
function inMealWindow(mealTime: string, minutes: number): boolean {
  const start = toMinutes(mealTime);
  return minutes >= start && minutes < start + MISSED_AFTER_MIN;
}

async function visitReminders(family: FamilyRow, now: Date) {
  const { date, minutes } = istNow(now);
  const tomorrow = shiftDate(date, 1);
  const lang = family.parent_lang;
  const vars = { n: family.parent_call_name, c: family.child_name };
  for (const visit of await visitsOn(family.id, [date, tomorrow])) {
    if (visit.visit_date === tomorrow && !visit.evening_sent_at && inMealWindow(family.meal_d, minutes)) {
      await toParent(family, visitText(lang, "visitEve", visit, vars));
      await markVisitReminded(visit.id, "evening");
    }
    if (visit.visit_date === date && !visit.morning_sent_at && inMealWindow(family.meal_b, minutes)) {
      const questions = doctorQuestions(lang, family.child_name, await latestReportValues(family.id));
      await toParent(family, `${visitText(lang, "visitMorning", visit, vars)}\n\n${questions}`);
      await markVisitReminded(visit.id, "morning");
    }
  }
}
