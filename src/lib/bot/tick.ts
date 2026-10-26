import "server-only";
import {
  activeMedicines,
  claimFollowup,
  claimReminder,
  claimResend,
  latestReportValues,
  linkedFamilies,
  markMissed,
  markVisitReminded,
  mealsSentToday,
  openDoses,
  stopEndedCourses,
  visitsOn,
} from "@/lib/db/repo";
import type { FamilyRow } from "@/lib/db/rows";
import { shiftDate } from "@/lib/domain/adherence";
import { mealTimes } from "@/lib/db/rows";
import { MISSED_AFTER_MIN, doseStep, dueReminders, istNow, medicinesFor, toMinutes } from "@/lib/domain/meals";
import type { MealKey, Medicine } from "@/lib/domain/types";
import { doctorQuestions, mealName, pm, reminderLines, visitText } from "@/lib/i18n/parent";
import { alertChild, inWindow, reminderToParent, sendMedicinePhotos, toParent } from "./send";

/**
 * Runs every few minutes (called by Supabase pg_cron):
 * 0. stops medicines whose course ended yesterday or earlier, and tells the child,
 * 1. sends meal reminders that are due,
 * 2. for reminders with no "Taken": sends them again when a "Later" is due, sends one follow-up
 *    30 minutes after the last reminder, and 60 minutes after the last reminder marks them
 *    not marked and alerts the child,
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
      try {
        // Claimed before sending, so an overlapping run skips it, and one that could not go is not tried again every few minutes.
        if (!(await claimReminder(family.id, date, meal))) continue;
        const delivered = await sendMealReminder(family, date, meal, meds);
        if (delivered) sent++;
        else await alertChild(family, "reminder_not_sent", { meal });
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
    const family = byId.get(dose.family_id);
    try {
      const step = doseStep(dose, now);
      if (step === "missed") {
        await markMissed(dose.id);
        if (family) await alertChild(family, "dose_missed", { meal: dose.meal });
        missed++;
      } else if (step === "resend" && family && (await claimResend(dose.id, now))) {
        const meds = await activeMedicines(family.id);
        if (medicinesFor(dose.meal, meds).length) await sendMealReminder(family, dose.dose_date, dose.meal, meds);
      } else if (step === "followup" && family && inWindow(family) && (await claimFollowup(dose.id, now))) {
        // Outside the 24-hour window a free follow-up would be refused, so none goes.
        const lang = family.parent_lang;
        await toParent(family, pm(lang, "followup", { n: family.parent_call_name, meal: mealName(lang, dose.meal) }), [
          { id: `taken:${dose.dose_date}:${dose.meal}`, title: pm(lang, "q_taken") },
        ]);
      }
    } catch (e) {
      console.error(`Open reminder step failed for dose ${dose.id}`, e);
    }
  }

  return { sent, missed };
}

/**
 * The meal reminder, with Taken, Later and My full list. Used for the first send and after "Later".
 * False when it could not go (outside the 24-hour window with no template).
 */
async function sendMealReminder(family: FamilyRow, date: string, meal: MealKey, meds: Medicine[]): Promise<boolean> {
  const lang = family.parent_lang;
  const body = `${pm(lang, "reminder", {
    meal: mealName(lang, meal),
    n: family.parent_call_name,
    c: family.child_name,
    lines: reminderLines(lang, meal, meds),
  })}\n${pm(lang, "matchName")}`;
  // Photos first, so the reminder with its Taken button is the last message. Outside the window only the template goes.
  if (inWindow(family)) await sendMedicinePhotos(family, medicinesFor(meal, meds));
  const oneLine = medicinesFor(meal, meds)
    .map((m) => `${m.name} ${m.strength}`)
    .join(", ");
  return reminderToParent(
    family,
    body,
    [
      { id: `taken:${date}:${meal}`, title: pm(lang, "q_taken") },
      { id: `later:${date}:${meal}`, title: pm(lang, "q_later") },
      { id: "list", title: pm(lang, "q_list") },
    ],
    [family.parent_call_name, mealName(lang, meal), oneLine],
  );
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
      await markVisitReminded(visit.id, "evening");
      if (inWindow(family)) await toParent(family, visitText(lang, "visitEve", visit, vars));
      else await alertChild(family, "reminder_not_sent");
    }
    if (visit.visit_date === date && !visit.morning_sent_at && inMealWindow(family.meal_b, minutes)) {
      await markVisitReminded(visit.id, "morning");
      // Outside the 24-hour window WhatsApp refuses a free message, and only says so later, so the child is told now.
      if (inWindow(family)) {
        const questions = doctorQuestions(lang, family.child_name, await latestReportValues(family.id));
        await toParent(family, `${visitText(lang, "visitMorning", visit, vars)}\n\n${questions}`);
      } else await alertChild(family, "reminder_not_sent");
    }
  }
}
