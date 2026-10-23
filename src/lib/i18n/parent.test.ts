import { describe, expect, it } from "vitest";
import type { RangeFlag, ReportValue } from "@/lib/domain/types";
import { REPORT_MAX, reportText } from "./parent";

const value = (test: string, flag: RangeFlag): ReportValue => ({
  test,
  valueText: "12.5 g/dL",
  valueNumber: 12.5,
  unit: "g/dL",
  rangeText: flag === "unknown" ? null : "13.0 - 17.0",
  rangeLow: flag === "unknown" ? null : 13,
  rangeHigh: flag === "unknown" ? null : 17,
  flag,
  whatItMeasures: { en: "Oxygen-carrying protein in blood", hi: "खून में ऑक्सीजन ले जाने वाला प्रोटीन", mr: "रक्तातील ऑक्सिजन वाहून नेणारे प्रथिन" },
});
const vars = { n: "Amma", c: "Rohan" };

describe("report summary", () => {
  it("counts every result and lists only those outside the printed range", () => {
    const text = reportText("en", vars, [value("Haemoglobin", "low"), value("Sodium", "in_range"), value("Vitamin B12", "unknown")], {});
    expect(text).toContain("I read 3 results: 1 within the printed range, 1 outside it, 1 with no printed range.");
    expect(text).toContain("• Haemoglobin: 12.5 g/dL. Printed range 13.0 - 17.0. Low.");
    expect(text).not.toContain("Sodium");
    expect(text).not.toContain("Vitamin B12");
    expect(text).toContain("Rohan can see the full report.");
  });

  it("says so when nothing is outside the range", () => {
    const text = reportText("en", vars, [value("Sodium", "in_range")], {});
    expect(text).toContain("No result is outside the printed range.");
    expect(text).not.toContain("Outside the printed range:");
  });

  it("fits one WhatsApp message for a long report, in every language", () => {
    const values = Array.from({ length: 120 }, (_, i) => value(`Test number ${i + 1} with a long name`, i % 2 ? "high" : "low"));
    for (const lang of ["en", "hi", "mr"] as const) {
      const text = reportText(lang, vars, values, {});
      expect(text.length).toBeLessThanOrEqual(REPORT_MAX);
      expect(text).toMatch(/120/);
    }
    expect(reportText("en", vars, values, {})).toMatch(/…and \d+ more\./);
  });
});
