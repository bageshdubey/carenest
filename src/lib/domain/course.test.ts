import { describe, expect, it } from "vitest";
import { listText, reminderLines } from "@/lib/i18n/parent";
import { courseEnd, courseEnded } from "./course";
import { dueReminders, medicinesFor } from "./meals";
import type { Medicine } from "./types";

const med = (name: string, extra: Partial<Medicine> = {}): Medicine => ({
  name,
  strength: "500 mg",
  quantity: "1 tablet",
  meals: ["b", "d"],
  food: "after",
  purpose: null,
  purposeSource: "none",
  needsCheck: false,
  ...extra,
});

describe("course length", () => {
  it("counts the start as day 1", () => {
    expect(courseEnd("2026-10-20", 5)).toBe("2026-10-24");
    expect(courseEnd("2026-10-30", 7)).toBe("2026-11-05");
    expect(courseEnd("2026-10-20", 1)).toBe("2026-10-20");
  });

  it("gives no end for a missing or odd number of days", () => {
    expect(courseEnd("2026-10-20", null)).toBeNull();
    expect(courseEnd("2026-10-20", 0)).toBeNull();
    expect(courseEnd("2026-10-20", 2.5)).toBeNull();
    expect(courseEnd("2026-10-20", 400)).toBeNull();
  });

  it("still reminds on the last day and stops the day after", () => {
    expect(courseEnded("2026-10-24", "2026-10-24")).toBe(false);
    expect(courseEnded("2026-10-24", "2026-10-25")).toBe(true);
    expect(courseEnded(null, "2026-10-25")).toBe(false);
  });
});

describe("only when needed", () => {
  const crocin = med("Crocin", { asNeeded: true, meals: [] });
  const amlo = med("Amlodipine", { meals: ["b"] });

  it("is never reminded, even with a meal left on it", () => {
    expect(medicinesFor("b", [crocin, amlo]).map((m) => m.name)).toEqual(["Amlodipine"]);
    expect(medicinesFor("b", [med("Crocin", { asNeeded: true, meals: ["b"] })])).toEqual([]);
    expect(reminderLines("en", "b", [crocin, amlo])).not.toContain("Crocin");
  });

  it("gives no reminder when it is the only medicine", () => {
    // 08:10 India time, inside the breakfast hour
    expect(dueReminders({ b: "08:00", l: "13:00", d: "20:00" }, [crocin], new Set(), new Date("2026-10-21T02:40:00Z"))).toEqual([]);
  });

  it("shows on the parent's list in its own group, after the meals", () => {
    const text = listText("en", [crocin, amlo]);
    expect(text).toContain("Breakfast:\n• Amlodipine 500 mg, 1 tablet, after food");
    expect(text).toContain("Only when needed (no reminder):\n• Crocin 500 mg, 1 tablet");
    expect(text.indexOf("Breakfast")).toBeLessThan(text.indexOf("Only when needed"));
  });
});

describe("parent's list", () => {
  it("shows the last day of a course", () => {
    const text = listText("en", [med("Augmentin", { meals: ["d"], endsOn: "2026-10-31" })]);
    expect(text).toContain("• Augmentin 500 mg, 1 tablet, after food, until 31 October");
  });
});
