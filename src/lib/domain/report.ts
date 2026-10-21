import type { RangeFlag } from "./types";

const NUM = String.raw`(\d+(?:\.\d+)?)`;

/**
 * Reads the range printed on a lab report. Handles "4.0 - 5.6", "70-100",
 * "4 to 5.6", "< 200", "<=5.7", "> 40", "Up to 5.7", "Below 100".
 * Returns nulls for any bound it cannot read.
 */
export function parseRange(text: string | null | undefined): { low: number | null; high: number | null } {
  if (!text) return { low: null, high: null };
  const t = text.replace(/,/g, "").toLowerCase();

  const between = t.match(new RegExp(`${NUM}\\s*(?:-|–|to)\\s*${NUM}`));
  if (between) return { low: Number(between[1]), high: Number(between[2]) };

  const upper = t.match(new RegExp(`(?:<=?|≤|up to|upto|below|less than)\\s*${NUM}`));
  if (upper) return { low: null, high: Number(upper[1]) };

  const lower = t.match(new RegExp(`(?:>=?|≥|above|more than|greater than)\\s*${NUM}`));
  if (lower) return { low: Number(lower[1]), high: null };

  return { low: null, high: null };
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
