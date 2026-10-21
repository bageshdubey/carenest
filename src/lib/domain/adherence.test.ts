import { describe, expect, it } from "vitest";
import { type DoseRow, dayStat, lastDays, monthToDate, shiftDate, totals } from "./adherence";

const rows: DoseRow[] = [
  { dose_date: "2026-10-20", meal: "b", status: "taken" },
  { dose_date: "2026-10-20", meal: "l", status: "missed" },
  { dose_date: "2026-10-20", meal: "d", status: "taken" },
  { dose_date: "2026-10-21", meal: "b", status: "taken" },
  { dose_date: "2026-10-21", meal: "l", status: "sent" },
  { dose_date: "2026-10-19", meal: "l", status: "missed" },
  { dose_date: "2026-10-19", meal: "d", status: "missed" },
];

describe("adherence", () => {
  it("shifts dates across months", () => {
    expect(shiftDate("2026-11-01", -1)).toBe("2026-10-31");
  });
  it("colours days by missed doses", () => {
    expect(dayStat("2026-10-20", rows).state).toBe("warn");
    expect(dayStat("2026-10-19", rows).state).toBe("bad");
    expect(dayStat("2026-10-21", rows).state).toBe("open");
    expect(dayStat("2026-10-10", rows).state).toBe("none");
  });
  it("builds the last 7 days oldest first", () => {
    const days = lastDays("2026-10-21", 7, rows);
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe("2026-10-15");
    expect(days[6].date).toBe("2026-10-21");
  });
  it("builds month to date", () => {
    expect(monthToDate("2026-10-21", rows)).toHaveLength(21);
  });
  it("counts only decided doses", () => {
    expect(totals(lastDays("2026-10-21", 7, rows))).toEqual({ taken: 3, decided: 6, pct: 50 });
    expect(totals([]).pct).toBeNull();
  });
});
