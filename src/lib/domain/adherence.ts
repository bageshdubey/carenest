import type { DoseStatus, MealKey } from "./types";

/** `later_until`: set while the parent put the reminder off with "Later". */
export type DoseRow = { dose_date: string; meal: MealKey; status: DoseStatus; later_until?: string | null };
export type DayState = "ok" | "warn" | "bad" | "none" | "open";
export type DayStat = { date: string; taken: number; missed: number; open: number; state: DayState };

/** "2026-10-21" shifted by n days. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayStat(date: string, doses: DoseRow[]): DayStat {
  const rows = doses.filter((d) => d.dose_date === date);
  const taken = rows.filter((d) => d.status === "taken").length;
  const missed = rows.filter((d) => d.status === "missed").length;
  const open = rows.filter((d) => d.status === "sent").length;
  let state: DayState = "none";
  if (missed >= 2) state = "bad";
  else if (missed === 1) state = "warn";
  else if (taken > 0) state = open > 0 ? "open" : "ok";
  else if (open > 0) state = "open";
  return { date, taken, missed, open, state };
}

/** The last `n` days ending today, oldest first. */
export function lastDays(today: string, n: number, doses: DoseRow[]): DayStat[] {
  return Array.from({ length: n }, (_, i) => dayStat(shiftDate(today, i - (n - 1)), doses));
}

/** Every day of today's month up to and including today. */
export function monthToDate(today: string, doses: DoseRow[]): DayStat[] {
  const day = Number(today.slice(8, 10));
  return Array.from({ length: day }, (_, i) => dayStat(`${today.slice(0, 8)}${String(i + 1).padStart(2, "0")}`, doses));
}

/** Taken out of decided doses (taken + not marked). Reminders still open don't count yet. */
export function totals(days: DayStat[]): { taken: number; decided: number; pct: number | null } {
  const taken = days.reduce((s, d) => s + d.taken, 0);
  const decided = days.reduce((s, d) => s + d.taken + d.missed, 0);
  return { taken, decided, pct: decided ? Math.round((taken / decided) * 100) : null };
}
