import type { ReportValue } from "./types";
import { isOutOfRange } from "./report";

/**
 * Groups every report's results by test, so the child sees one row per test across reports.
 * A test matches by its lower-case name, as the bot does for "last time", and by unit, so
 * mg/dL is never compared with mmol/L. Different names for the same test stay separate:
 * deciding they are the same would be a medical judgement, which CareNest never makes.
 */
export type TrendPoint = { reportId: string; valueText: string; valueNumber: number | null };
export type TestTrend = {
  key: string;
  latest: ReportValue;
  /** Oldest first. */
  points: TrendPoint[];
  /** Latest value against the one before it, when both are numbers. Plain arithmetic, no judgement. */
  direction: "up" | "down" | "same" | null;
};

type ReportIn = { id: string; created_at: string; values: ReportValue[] };

const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export function testKey(v: Pick<ReportValue, "test" | "unit">): string {
  return `${norm(v.test)}|${norm(v.unit)}`;
}

export function groupByTest(reports: ReportIn[]): TestTrend[] {
  const oldestFirst = [...reports].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const groups = new Map<string, { latest: ReportValue; points: TrendPoint[] }>();
  for (const r of oldestFirst) {
    for (const v of r.values) {
      const key = testKey(v);
      const point = { reportId: r.id, valueText: v.valueText, valueNumber: v.valueNumber };
      const g = groups.get(key);
      if (!g) groups.set(key, { latest: v, points: [point] });
      // A test printed twice in one report keeps the later line, as one reading.
      else if (g.points.at(-1)?.reportId === r.id) {
        g.points[g.points.length - 1] = point;
        g.latest = v;
      } else {
        g.points.push(point);
        g.latest = v;
      }
    }
  }

  const trends = [...groups].map(([key, g]) => ({ key, latest: g.latest, points: g.points, direction: direction(g.points) }));
  // Results outside the printed range first, then by name.
  return trends.sort((a, b) => Number(isOutOfRange(b.latest.flag)) - Number(isOutOfRange(a.latest.flag)) || a.latest.test.localeCompare(b.latest.test));
}

function direction(points: TrendPoint[]): TestTrend["direction"] {
  if (points.length < 2) return null;
  const now = points[points.length - 1].valueNumber;
  const before = points[points.length - 2].valueNumber;
  if (now === null || before === null) return null;
  return now > before ? "up" : now < before ? "down" : "same";
}

/** How many results in one report are outside the printed range. */
export function outsideCount(values: ReportValue[]): number {
  return values.filter((v) => isOutOfRange(v.flag)).length;
}
