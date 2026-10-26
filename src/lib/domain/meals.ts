import { MEALS, type MealKey, type MealTimes, type Medicine } from "./types";

const IST_OFFSET_MIN = 330;

/** Minutes since midnight for "HH:MM". */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Today's date (YYYY-MM-DD) and minutes since midnight, in India time. */
export function istNow(now: Date = new Date()): { date: string; minutes: number } {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    date: ist.toISOString().slice(0, 10),
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

export function mealsInOrder(times: MealTimes): boolean {
  return toMinutes(times.b) < toMinutes(times.l) && toMinutes(times.l) < toMinutes(times.d);
}

/** Medicines reminded at this meal. "Only when needed" and "once a week" medicines never are. */
export function medicinesFor(meal: MealKey, meds: Medicine[]): Medicine[] {
  return meds.filter((m) => !m.asNeeded && !m.weekly && m.meals.includes(meal));
}

/** How long after a meal time a dose stays open before it counts as not marked. */
export const MISSED_AFTER_MIN = 60;

/**
 * Meals whose reminder is due now: the meal time has passed, we are still
 * inside the open window, the meal has tablets, and no reminder went out today.
 */
export function dueReminders(
  times: MealTimes,
  meds: Medicine[],
  alreadySent: Set<MealKey>,
  now: Date = new Date(),
): MealKey[] {
  const { minutes } = istNow(now);
  return MEALS.filter((meal) => {
    const start = toMinutes(times[meal]);
    return (
      minutes >= start &&
      minutes < start + MISSED_AFTER_MIN &&
      medicinesFor(meal, meds).length > 0 &&
      !alreadySent.has(meal)
    );
  });
}

/** True when a reminder sent at `sentAt` has passed the open window without "Taken". */
export function isOverdue(sentAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - sentAt.getTime() >= MISSED_AFTER_MIN * 60_000;
}

/** "Later" puts the reminder off by this long, at most this many times per dose. */
export const LATER_MIN = 30;
export const MAX_LATER = 2;
/** One "just checking" message this long after the last reminder, if "Taken" has not come. */
export const FOLLOWUP_AFTER_MIN = 30;

export type OpenDose = { sent_at: string; reminded_at: string | null; later_until: string | null; followup_at: string | null };

/**
 * What the scheduler does next with a reminder that has no "Taken" yet:
 * resend it when a "Later" is due, wait while one is pending, send the one follow-up
 * 30 minutes after the last reminder, and count it as not marked 60 minutes after the last reminder.
 */
export function doseStep(dose: OpenDose, now: Date = new Date()): "resend" | "wait" | "followup" | "missed" {
  if (dose.later_until) return now.getTime() >= new Date(dose.later_until).getTime() ? "resend" : "wait";
  const last = new Date(dose.reminded_at ?? dose.sent_at);
  if (isOverdue(last, now)) return "missed";
  if (!dose.followup_at && now.getTime() - last.getTime() >= FOLLOWUP_AFTER_MIN * 60_000) return "followup";
  return "wait";
}

/** The India time of a moment, as "2:05 pm". */
export function istClock(at: Date): string {
  const { minutes } = istNow(at);
  return formatTime(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
}

/** "13:30" -> "1:30 pm" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}
