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

/** Medicines reminded at this meal. "Only when needed" medicines never are. */
export function medicinesFor(meal: MealKey, meds: Medicine[]): Medicine[] {
  return meds.filter((m) => !m.asNeeded && m.meals.includes(meal));
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

/** "13:30" -> "1:30 pm" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}
