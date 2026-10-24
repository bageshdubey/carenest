import { describe, expect, it } from "vitest";
import { groupByTest, outsideCount } from "./trends";
import type { ReportValue } from "./types";

const v = (test: string, n: number | null, flag: ReportValue["flag"] = "in_range", unit: string | null = "mg/dL"): ReportValue => ({
  test,
  valueText: n === null ? "Positive" : `${n} ${unit ?? ""}`.trim(),
  valueNumber: n,
  unit,
  rangeText: null,
  rangeLow: null,
  rangeHigh: null,
  flag,
  whatItMeasures: null,
});

describe("results grouped by test", () => {
  it("joins the same test across reports, oldest first, whatever order the reports come in", () => {
    const trends = groupByTest([
      { id: "c", created_at: "2026-10-18T10:00:00Z", values: [v("Glucose Fasting", 142, "high")] },
      { id: "a", created_at: "2026-05-20T10:00:00Z", values: [v("Glucose fasting", 118)] },
      { id: "b", created_at: "2026-09-02T10:00:00Z", values: [v("glucose  fasting", 131, "high")] },
    ]);
    expect(trends).toHaveLength(1);
    expect(trends[0].points.map((p) => p.valueNumber)).toEqual([118, 131, 142]);
    expect(trends[0].latest.valueNumber).toBe(142);
    expect(trends[0].direction).toBe("up");
  });

  it("keeps different units apart", () => {
    const trends = groupByTest([
      { id: "a", created_at: "2026-05-20T10:00:00Z", values: [v("Glucose", 100)] },
      { id: "b", created_at: "2026-09-02T10:00:00Z", values: [v("Glucose", 5.6, "in_range", "mmol/L")] },
    ]);
    expect(trends).toHaveLength(2);
    expect(trends.every((t) => t.direction === null)).toBe(true);
  });

  it("gives no direction for one report, or when a value is not a number", () => {
    const one = groupByTest([{ id: "a", created_at: "2026-05-20T10:00:00Z", values: [v("TSH", 2.1)] }]);
    expect(one[0].direction).toBeNull();
    const text = groupByTest([
      { id: "a", created_at: "2026-05-20T10:00:00Z", values: [v("Urine sugar", 0)] },
      { id: "b", created_at: "2026-09-02T10:00:00Z", values: [v("Urine sugar", null, "unknown")] },
    ]);
    expect(text[0].direction).toBeNull();
  });

  it("says same when the value did not change, and down when it fell", () => {
    const [same] = groupByTest([
      { id: "a", created_at: "2026-05-20T10:00:00Z", values: [v("Hb", 12.8)] },
      { id: "b", created_at: "2026-09-02T10:00:00Z", values: [v("Hb", 12.8)] },
    ]);
    expect(same.direction).toBe("same");
    const [down] = groupByTest([
      { id: "a", created_at: "2026-05-20T10:00:00Z", values: [v("Hb", 12.8)] },
      { id: "b", created_at: "2026-09-02T10:00:00Z", values: [v("Hb", 11.9, "low")] },
    ]);
    expect(down.direction).toBe("down");
  });

  it("counts a test printed twice in one report once", () => {
    const [t] = groupByTest([{ id: "a", created_at: "2026-05-20T10:00:00Z", values: [v("Hb", 12.1), v("Hb", 12.4)] }]);
    expect(t.points).toHaveLength(1);
    expect(t.latest.valueNumber).toBe(12.4);
  });

  it("puts results outside the range first, then sorts by name", () => {
    const trends = groupByTest([{ id: "a", created_at: "2026-05-20T10:00:00Z", values: [v("Creatinine", 0.9), v("TSH", 6.2, "high"), v("Albumin", 4.1)] }]);
    expect(trends.map((t) => t.latest.test)).toEqual(["TSH", "Albumin", "Creatinine"]);
  });
});

describe("outside count", () => {
  it("counts high and low only", () => {
    expect(outsideCount([v("A", 1, "high"), v("B", 1, "low"), v("C", 1, "in_range"), v("D", null, "unknown")])).toBe(2);
  });
});
