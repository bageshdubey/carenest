import { shiftDate } from "./adherence";

/** Longest course read from a photo. Anything longer is treated as no end, for the child to set. */
const MAX_COURSE_DAYS = 365;

/**
 * Last day of a course of `days` days that starts on `start` (the start counts as day 1).
 * "5 days" from 20 Oct ends on 24 Oct. Null when the number of days is missing or not sensible.
 */
export function courseEnd(start: string, days: number | null): string | null {
  if (!days || !Number.isInteger(days) || days < 1 || days > MAX_COURSE_DAYS) return null;
  return shiftDate(start, days - 1);
}

/** True once the last day has passed. Reminders still go on the last day itself. */
export function courseEnded(endsOn: string | null | undefined, today: string): boolean {
  return !!endsOn && endsOn < today;
}
