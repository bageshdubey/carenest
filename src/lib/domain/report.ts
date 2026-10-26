import type { RangeFlag } from "./types";

const NUM = String.raw`(\d+(?:\.\d+)?)`;

/**
 * Reads the range printed on a lab report. Handles "4.0 - 5.6", "70-100",
 * "4 to 5.6", "< 200", "<=5.7", "> 40", "Up to 5.7", "Below 100".
 * Returns nulls for any bound it cannot read.
 */
export function parseRange(text: string | null | undefined): { low: number | null; high: number | null } {
  const none = { low: null, high: null };
  if (!text) return none;
  const t = text.replace(/,/g, "").toLowerCase();
  const BETWEEN = `${NUM}\\s*(?:-|–|to)\\s*${NUM}`;
  const UPPER = `(?:<=?|≤|up to|upto|below|less than)\\s*${NUM}`;
  const LOWER = `(?:>=?|≥|above|more than|greater than)\\s*${NUM}`;

  // Several ranges in one ("Male: 13-17 Female: 12-15", "Desirable: <200 Borderline: 200-239 High: >=240"):
  // which one applies is not ours to pick, so the value gets no flag.
  const betweens = t.match(new RegExp(BETWEEN, "g")) ?? [];
  const rest = t.replace(new RegExp(BETWEEN, "g"), " ");
  const bounds = (rest.match(new RegExp(UPPER, "g")) ?? []).length + (rest.match(new RegExp(LOWER, "g")) ?? []).length;
  if (betweens.length + bounds > 1) return none;

  const between = t.match(new RegExp(BETWEEN));
  if (between) return { low: Number(between[1]), high: Number(between[2]) };

  const upper = t.match(new RegExp(UPPER));
  if (upper) return { low: null, high: Number(upper[1]) };

  const lower = t.match(new RegExp(LOWER));
  if (lower) return { low: Number(lower[1]), high: null };

  return none;
}

/**
 * Compares a value with the printed range. This is a plain comparison done in
 * code, never by the AI, so the flag is always exactly what the report says.
 */
export function flagValue(value: number | null, low: number | null, high: number | null): RangeFlag {
  if (value === null || Number.isNaN(value)) return "unknown";
  if (low === null && high === null) return "unknown";
  if (high !== null && value > high) return "high";
  if (low !== null && value < low) return "low";
  return "in_range";
}

export function isOutOfRange(flag: RangeFlag): boolean {
  return flag === "high" || flag === "low";
}
