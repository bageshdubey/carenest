import { describe, expect, it } from "vitest";
import type { RangeFlag, ReportValue } from "@/lib/domain/types";
import { REPORT_MAX, pm, reportText } from "./parent";

const value = (test: string, flag: RangeFlag): ReportValue => ({
  test,
  valueText: "12.5 g/dL",
  valueNumber: 12.5,
  unit: "g/dL",
  rangeText: flag === "unknown" ? null : "13.0 - 17.0",
  rangeLow: flag === "unknown" ? null : 13,
  rangeHigh: flag === "unknown" ? null : 17,
  flag,
  whatItMeasures: {
    en: "A protein in red blood cells\nTo check how well blood carries oxygen",
    hi: "लाल रक्त कोशिकाओं में एक प्रोटीन\nयह देखने के लिए कि खून ऑक्सीजन कितनी अच्छी तरह ले जाता है",
    mr: "लाल रक्तपेशींमधील एक प्रथिन\nरक्त ऑक्सिजन किती चांगले वाहून नेते हे पाहण्यासाठी",
  },
});
const vars = { n: "Amma", c: "Rohan" };

describe("report summary", () => {
  it("counts every result and lists only those outside the printed range", () => {
    const text = reportText("en", vars, [value("Haemoglobin", "low"), value("Sodium", "in_range"), value("Vitamin B12", "unknown")], {});
    expect(text).toContain("I read 3 results: 1 within the printed range, 1 outside it, 1 with no printed range.");
    expect(text).toContain("Please show these to your doctor: Haemoglobin (low).");
    expect(text).toContain("• Haemoglobin: 12.5 g/dL. Printed range 13.0 - 17.0. Low.\n  What it is: A protein in red blood cells\n  Why it's done: To check how well blood carries oxygen");
    expect(text).not.toContain("Sodium");
    expect(text).not.toContain("Vitamin B12");
    expect(text).toContain("Rohan can see the full report.");
  });

  it("says so when nothing is outside the range", () => {
    const text = reportText("en", vars, [value("Sodium", "in_range")], {});
    expect(text).toContain("No result is outside the printed range.");
    expect(text).not.toContain("Outside the printed range:");
    expect(text).not.toContain("show these to your doctor");
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

  it("keeps the report's order and names at most 8 tests in the doctor line", () => {
    const values = Array.from({ length: 10 }, (_, i) => value(`T${i + 1}`, "high"));
    expect(reportText("en", vars, values, {})).toContain(
      "Please show these to your doctor: T1 (high), T2 (high), T3 (high), T4 (high), T5 (high), T6 (high), T7 (high), T8 (high), and 2 more.",
    );
  });

  it("shows one line for older reports that only say what the test is", () => {
    const old = { ...value("Sodium", "high"), whatItMeasures: { en: "Salt level in blood", hi: "खून में नमक", mr: "रक्तातील मीठ" } };
    const text = reportText("en", vars, [old], {});
    expect(text).toContain("  What it is: Salt level in blood");
    expect(text).not.toContain("Why it's done");
  });
});

describe("CareNest's voice", () => {
  // The Hindi and Marathi voices are women's, so CareNest never says "I" in the masculine.
  const KEYS = ["welcome", "readingIt", "checked", "fixed", "repIntro", "repOutro", "busy"] as const;
  const vars = { n: "Amma", c: "Rahul" };

  it("speaks as a woman in Hindi", () => {
    const text = KEYS.map((k) => pm("hi", k, vars)).join(" ");
    expect(text).not.toMatch(/दूँगा|ऊँगा|माँगता|भेजता|सकता हूँ|करता हूँ|सकता।|थोड़ा व्यस्त/);
    expect(text).toMatch(/दिलाऊँगी/);
  });

  it("speaks as a woman in Marathi", () => {
    const text = KEYS.map((k) => pm("mr", k, vars)).join(" ");
    expect(text).not.toMatch(/शकतो|करतो|थोडा व्यस्त/);
    expect(text).toMatch(/शकते/);
  });
});
